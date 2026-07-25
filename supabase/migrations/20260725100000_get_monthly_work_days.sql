
-- Function: get_monthly_work_days
-- Description: Calculates the total number of working days for a specific user in a given month.
-- Parameters:
--   p_user_id: UUID of the user.
--   p_month: The month to calculate (format 'YYYY-MM').
-- Returns: An integer representing the total count of working days.

CREATE OR REPLACE FUNCTION get_monthly_work_days(p_user_id UUID, p_month TEXT)
RETURNS INT AS $$
DECLARE
    total_days INT;
    month_start DATE;
    month_end DATE;
BEGIN
    -- Determine the start and end dates of the given month
    month_start := date_trunc('month', p_month::date);
    month_end := month_start + interval '1 month' - interval '1 day';

    -- Calculate the total number of working days
    SELECT COUNT(*)
    INTO total_days
    FROM employee_schedules es
    JOIN shift_schedules ss ON es.shift_code = ss.shift_code
    WHERE es.user_id = p_user_id
      AND es.date BETWEEN month_start AND month_end
      AND ss.is_working_day = TRUE
      -- The day of the week for a date needs to match the shift's working day
      AND ss.day_of_week = EXTRACT(ISODOW FROM es.date) - 1; -- Monday=0 .. Sunday=6

    RETURN total_days;
END;
$$ LANGUAGE plpgsql;
