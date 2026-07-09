-- ============================================================
-- MIGRATION: Server-side validasi radius absensi
-- ============================================================
-- Validasi dilakukan di SERVER supaya tidak bisa diakali
-- dengan refresh berulang dari sisi client.
-- ============================================================

DROP FUNCTION IF EXISTS verify_attendance_location(double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION verify_attendance_location(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location attendance_locations%ROWTYPE;
  v_distance DOUBLE PRECISION;
  v_radius INT;
  v_within_radius BOOLEAN;
  v_latest_rejection INTERVAL;
BEGIN
  -- 1. Ambil lokasi aktif
  SELECT * INTO v_location
  FROM attendance_locations
  WHERE is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Tidak ada lokasi puskesmas aktif',
      'distance', null,
      'radius', null
    );
  END IF;

  v_radius := v_location.radius_meter;

  -- 2. Hitung jarak (Haversine) di server
  v_distance := 6371000 * 2 * asin(
    sqrt(
      power(sin(radians(p_latitude - v_location.latitude) / 2), 2)
      + cos(radians(v_location.latitude))
      * cos(radians(p_latitude))
      * power(sin(radians(p_longitude - v_location.longitude) / 2), 2)
    )
  );

  -- 3. Validasi radius
  v_within_radius := v_distance <= v_radius;

  -- 4. Anti-fake-GPS: accuracy terlalu sempurna (< 5m) = curiga
  IF p_accuracy IS NOT NULL AND p_accuracy < 5 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Akurasi GPS mencurigakan (' || round(p_accuracy::numeric, 1) || 'm)',
      'distance', round(v_distance)::INT,
      'radius', v_radius,
      'puskesmas_name', v_location.name,
      'suspicious_accuracy', true
    );
  END IF;

  -- 5. Kembalikan hasil
  RETURN jsonb_build_object(
    'valid', v_within_radius,
    'error', CASE WHEN v_within_radius THEN null ELSE 'Luar radius puskesmas' END,
    'distance', round(v_distance)::INT,
    'radius', v_radius,
    'puskesmas_name', v_location.name,
    'puskesmas_latitude', v_location.latitude,
    'puskesmas_longitude', v_location.longitude,
    'suspicious_accuracy', false
  );
END;
$$;