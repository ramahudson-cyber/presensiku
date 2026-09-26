CREATE OR REPLACE FUNCTION public.match_attendance_location(p_latitude double precision, p_longitude double precision, p_accuracy double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_nearest attendance_locations%ROWTYPE;
  v_match   attendance_locations%ROWTYPE;
  v_nearest_distance DOUBLE PRECISION;
  v_match_distance   DOUBLE PRECISION;
  v_tolerance        DOUBLE PRECISION := LEAST(COALESCE(p_accuracy, 0), 50);
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
$function$

