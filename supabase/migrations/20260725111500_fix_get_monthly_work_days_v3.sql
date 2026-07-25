-- Function: get_monthly_work_days (Version 3)
-- Description: Corrects the day of week logic with a robust CASE statement to eliminate any ambiguity.
-- Fix: Replaces modulo arithmetic with an explicit CASE statement mapping ISODOW (Mon=1..Sun=7)
--      to the application's internal representation (Mon=0..Sun=6).

CREATE OR REPLACE FUNCTION get_monthly_work_days(p_user_id UUID, p_month TEXT)
RETURNS INT AS $$
DECLARE
    total_days INT;
    month_start DATE;
    month_end DATE;
BEGIN
    month_start := date_trunc('month', p_month::date);
    month_end := month_start + interval '1 month' - interval '1 day';

    SELECT COUNT(*)
    INTO total_days
    FROM employee_schedules es
    JOIN shift_schedules ss ON es.shift_code = ss.shift_code
    WHERE es.user_id = p_user_id
      AND es.date BETWEEN month_start AND month_end
      AND ss.is_working_day = TRUE
      -- Explicitly map PostgreSQL's ISODOW (Mon=1..Sun=7) to our app's logic (Mon=0..Sun=6)
      AND ss.day_of_week = CASE EXTRACT(ISODOW FROM es.date)
                              WHEN 1 THEN 0 -- Monday
                              WHEN 2 THEN 1 -- Tuesday
                              WHEN 3 THEN 2 -- Wednesday
                              WHEN 4 THEN 3 -- Thursday
                              WHEN 5 THEN 4 -- Friday
                              WHEN 6 THEN 5 -- Saturday
                              WHEN 7 THEN 6 -- Sunday
                           END;

    RETURN total_days;
END;
$$ LANGUAGE plpgsql;
