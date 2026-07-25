-- Function: get_monthly_work_days (Version 2)
-- Description: Corrects the day of week logic to align with how shift_schedules stores it.
-- Fix: Removes the '- 1' from the day_of_week calculation. `ss.day_of_week` is stored as Monday=0, Sunday=6.
--      PostgreSQL's EXTRACT(DOW FROM date) is Sunday=0, Saturday=6.
--      PostgreSQL's EXTRACT(ISODOW FROM date) is Monday=1, Sunday=7.
--      The correct logic is `(EXTRACT(ISODOW FROM es.date) + 6) % 7` to map to Monday=0.

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
      -- Correctly map PostgreSQL's ISODOW (Mon=1..Sun=7) to our app's logic (Mon=0..Sun=6)
      AND ss.day_of_week = ((EXTRACT(ISODOW FROM es.date)::int + 6) % 7);

    RETURN total_days;
END;
$$ LANGUAGE plpgsql;
