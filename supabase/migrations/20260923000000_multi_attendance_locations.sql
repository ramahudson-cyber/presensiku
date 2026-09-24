-- ============================================================
-- MIGRATION: Multi-lokasi absensi per instansi
-- ============================================================
-- Semua lokasi aktif dalam satu instansi dapat dipakai bersama.
-- Validasi client dan trigger memakai helper yang sama agar hasilnya konsisten.
-- ============================================================

-- 1. Kembalikan seluruh lokasi aktif milik instansi pemanggil.
CREATE OR REPLACE FUNCTION get_active_location()
RETURNS SETOF attendance_locations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT *
  FROM attendance_locations
  WHERE is_active = true
    AND organization_id = current_org_id()
  ORDER BY name ASC, id ASC;
$$;

-- 2. Cari lokasi aktif terdekat dan lokasi aktif yang memenuhi radius.
-- Akurasi GPS diberi toleransi maksimal 30 m, sama dengan aturan sebelumnya.
CREATE OR REPLACE FUNCTION match_attendance_location(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_nearest attendance_locations%ROWTYPE;
  v_match   attendance_locations%ROWTYPE;
  v_nearest_distance DOUBLE PRECISION;
  v_match_distance   DOUBLE PRECISION;
  v_tolerance        DOUBLE PRECISION := LEAST(COALESCE(p_accuracy, 0), 30);
  v_result            JSONB;
BEGIN
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Lokasi wajib dikirim saat absen',
      'distance', null,
      'radius', null,
      'suspicious_accuracy', false
    );
  END IF;

  -- Ambil lokasi terdekat untuk pesan dan tampilan, walaupun belum masuk radius.
  SELECT l.*
    INTO v_nearest
  FROM attendance_locations l
  WHERE l.is_active = true
    AND l.organization_id = current_org_id()
  ORDER BY geo_distance_m(p_latitude, p_longitude, l.latitude, l.longitude), l.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Tidak ada lokasi instansi aktif',
      'distance', null,
      'radius', null,
      'location_id', null,
      'location_name', null,
      'puskesmas_name', null,
      'suspicious_accuracy', false
    );
  END IF;

  v_nearest_distance := geo_distance_m(
    p_latitude, p_longitude, v_nearest.latitude, v_nearest.longitude
  );

  -- Tolak akurasi yang tidak dikirim atau terlalu sempurna sebelum menerima match.
  IF p_accuracy IS NULL OR p_accuracy <= 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Akurasi GPS tidak dikirim perangkat',
      'distance', round(v_nearest_distance)::INT,
      'radius', v_nearest.radius_meter,
      'location_id', v_nearest.id,
      'location_name', v_nearest.name,
      'puskesmas_name', v_nearest.name,
      'location_latitude', v_nearest.latitude,
      'location_longitude', v_nearest.longitude,
      'puskesmas_latitude', v_nearest.latitude,
      'puskesmas_longitude', v_nearest.longitude,
      'suspicious_accuracy', true
    );
  END IF;

  IF p_accuracy < 5 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Akurasi GPS mencurigakan (' || round(p_accuracy::numeric, 1) || 'm)',
      'distance', round(v_nearest_distance)::INT,
      'radius', v_nearest.radius_meter,
      'location_id', v_nearest.id,
      'location_name', v_nearest.name,
      'puskesmas_name', v_nearest.name,
      'location_latitude', v_nearest.latitude,
      'location_longitude', v_nearest.longitude,
      'puskesmas_latitude', v_nearest.latitude,
      'puskesmas_longitude', v_nearest.longitude,
      'suspicious_accuracy', true
    );
  END IF;

  SELECT l.*
    INTO v_match
  FROM attendance_locations l
  WHERE l.is_active = true
    AND l.organization_id = current_org_id()
    AND geo_distance_m(p_latitude, p_longitude, l.latitude, l.longitude)
        <= l.radius_meter + v_tolerance
  ORDER BY geo_distance_m(p_latitude, p_longitude, l.latitude, l.longitude), l.id
  LIMIT 1;

  IF FOUND THEN
    v_match_distance := geo_distance_m(
      p_latitude, p_longitude, v_match.latitude, v_match.longitude
    );

    v_result := jsonb_build_object(
      'valid', true,
      'error', null,
      'distance', round(v_match_distance)::INT,
      'distance_from_location', round(v_match_distance)::INT,
      'radius', v_match.radius_meter,
      'location_id', v_match.id,
      'location_name', v_match.name,
      'puskesmas_name', v_match.name,
      'location_latitude', v_match.latitude,
      'location_longitude', v_match.longitude,
      'puskesmas_latitude', v_match.latitude,
      'puskesmas_longitude', v_match.longitude,
      'suspicious_accuracy', false
    );
    RETURN v_result;
  END IF;

  RETURN jsonb_build_object(
    'valid', false,
    'error', 'Luar radius lokasi absensi',
    'distance', round(v_nearest_distance)::INT,
    'distance_from_location', round(v_nearest_distance)::INT,
    'radius', v_nearest.radius_meter,
    'location_id', v_nearest.id,
    'location_name', v_nearest.name,
    'puskesmas_name', v_nearest.name,
    'location_latitude', v_nearest.latitude,
    'location_longitude', v_nearest.longitude,
    'puskesmas_latitude', v_nearest.latitude,
    'puskesmas_longitude', v_nearest.longitude,
    'suspicious_accuracy', false
  );
END;
$$;

-- 3. Trigger guard: satu-satunya otoritas final untuk check-in/check-out.
CREATE OR REPLACE FUNCTION assert_within_radius(p_loc JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_acc DOUBLE PRECISION;
  v_match JSONB;
  v_valid BOOLEAN;
  v_error TEXT;
BEGIN
  IF p_loc IS NULL THEN
    RAISE EXCEPTION 'Lokasi wajib dikirim saat absen';
  END IF;

  v_lat := (p_loc->>'latitude')::double precision;
  v_lon := (p_loc->>'longitude')::double precision;
  v_acc := (p_loc->>'accuracy')::double precision;

  IF v_lat IS NULL OR v_lon IS NULL THEN
    RAISE EXCEPTION 'Lokasi wajib dikirim saat absen';
  END IF;

  v_match := match_attendance_location(v_lat, v_lon, v_acc);
  v_valid := COALESCE((v_match->>'valid')::boolean, false);
  v_error := COALESCE(v_match->>'error', 'Lokasi berada di luar radius absensi');

  IF NOT v_valid THEN
    RAISE EXCEPTION '%', v_error;
  END IF;

  -- distance_from_puskesmas dipertahankan untuk kompatibilitas riwayat lama.
  RETURN p_loc || jsonb_strip_nulls(jsonb_build_object(
    'distance_from_puskesmas', (v_match->>'distance')::INT,
    'distance_from_location', (v_match->>'distance')::INT,
    'matched_location_id', v_match->'location_id',
    'matched_location_name', v_match->'location_name',
    'matched_location_radius', v_match->'radius',
    'matched_location_latitude', v_match->'location_latitude',
    'matched_location_longitude', v_match->'location_longitude'
  ));
END;
$$;

-- 4. RPC memakai helper yang sama dengan trigger.
CREATE OR REPLACE FUNCTION verify_attendance_location(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT match_attendance_location(p_latitude, p_longitude, p_accuracy);
$$;

REVOKE ALL ON FUNCTION match_attendance_location(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_attendance_location(double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION match_attendance_location(double precision, double precision, double precision) TO service_role;
