import { Injectable } from '@angular/core';

export interface ArrivalTimeResult {
  time: string;
  nextDay: boolean;
}

/**
 * ArrivalTimeService - Centralized service for arrival time calculations
 *
 * Handles consistent arrival time display across all pages:
 * - Bus cards (calculate if not provided)
 * - Seat selection
 * - Payment page
 * - Booking confirmation
 *
 * Supports:
 * - Same-day arrivals
 * - Cross-midnight arrivals (next day indicator)
 * - User-provided arrival times (preferred over calculation)
 */
@Injectable({
  providedIn: 'root'
})
export class ArrivalTimeService {

  constructor() { }

  /**
   * Calculate arrival time based on departure and duration
   *
   * @param departureTime - Departure time in HH:MM format (e.g., "14:30")
   * @param durationHours - Journey duration in hours (decimal or integer)
   * @param actualArrivalTime - Optional: use provided arrival time if available
   * @returns ArrivalTimeResult with time and nextDay flag
   *
   * Examples:
   * - 09:00 + 8h = 17:00 (same day)
   * - 23:00 + 3h = 02:00 (next day) ← nextDay: true
   * - 14:30 + 2.5h = 17:00 (same day)
   *
   * If actualArrivalTime is provided and valid, it's returned as-is
   */
  calculateArrivalTime(
    departureTime: string,
    durationHours: number,
    actualArrivalTime?: string
  ): ArrivalTimeResult {
    // If actual arrival time is provided and non-empty, use it
    if (actualArrivalTime && actualArrivalTime.trim()) {
      return {
        time: actualArrivalTime,
        nextDay: this.isNextDayArrival(departureTime, actualArrivalTime)
      };
    }

    // Parse departure time
    const [depHour, depMinute] = this.parseTime(departureTime);
    if (depHour === -1) {
      return { time: 'Invalid time', nextDay: false };
    }

    // Calculate arrival
    const departureMinutes = depHour * 60 + depMinute;
    const durationMinutes = Math.round(durationHours * 60);
    const arrivalMinutes = departureMinutes + durationMinutes;

    // Determine if next day
    const totalMinutesInDay = 24 * 60;
    const nextDay = arrivalMinutes >= totalMinutesInDay;

    // Normalize time to 24-hour format
    const normalizedMinutes = arrivalMinutes % totalMinutesInDay;
    const arrivalHour = Math.floor(normalizedMinutes / 60);
    const arrivalMin = normalizedMinutes % 60;

    const timeStr = this.formatTime(arrivalHour, arrivalMin);

    return {
      time: timeStr,
      nextDay
    };
  }

  /**
   * Determine if arrival is on next day by comparing times
   * Used when actual arrival time is provided
   *
   * @param departureTime - Departure time in HH:MM format
   * @param arrivalTime - Arrival time in HH:MM format
   * @returns true if arrival is on next day, false otherwise
   */
  private isNextDayArrival(departureTime: string, arrivalTime: string): boolean {
    const [depHour] = this.parseTime(departureTime);
    const [arrHour] = this.parseTime(arrivalTime);

    if (depHour === -1 || arrHour === -1) {
      return false;
    }

    // If arrival hour is less than departure hour, it's next day
    // (e.g., 23:00 → 02:00 means 02 < 23)
    return arrHour < depHour;
  }

  /**
   * Parse time string in HH:MM format
   *
   * @param timeStr - Time string (e.g., "14:30", "09:00")
   * @returns [hour, minute] tuple, or [-1, -1] if invalid
   */
  private parseTime(timeStr: string): [number, number] {
    if (!timeStr || typeof timeStr !== 'string') {
      return [-1, -1];
    }

    const parts = timeStr.trim().split(':');
    if (parts.length !== 2) {
      return [-1, -1];
    }

    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return [-1, -1];
    }

    return [hour, minute];
  }

  /**
   * Format time as HH:MM string
   *
   * @param hour - Hour (0-23)
   * @param minute - Minute (0-59)
   * @returns Formatted time string
   */
  private formatTime(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  /**
   * Get display string for arrival with next-day indicator
   *
   * @param arrivalTime - Arrival time in HH:MM format
   * @param nextDay - Whether arrival is on next day
   * @returns Display string (e.g., "02:00 (+1 day)")
   */
  getDisplayString(arrivalTime: string, nextDay: boolean): string {
    const dayIndicator = nextDay ? ' (+1 day)' : '';
    return `${arrivalTime}${dayIndicator}`;
  }

  /**
   * Calculate duration string from departure and arrival times
   *
   * @param departureTime - Departure time in HH:MM format
   * @param arrivalTime - Arrival time in HH:MM format
   * @param nextDay - Whether arrival is on next day
   * @returns Duration string (e.g., "10h 30m")
   */
  calculateDuration(departureTime: string, arrivalTime: string, nextDay: boolean): string {
    const [depHour, depMinute] = this.parseTime(departureTime);
    const [arrHour, arrMinute] = this.parseTime(arrivalTime);

    if (depHour === -1 || arrHour === -1) {
      return 'Unknown';
    }

    let durationMinutes = (arrHour * 60 + arrMinute) - (depHour * 60 + depMinute);

    if (nextDay) {
      durationMinutes += 24 * 60;
    }

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }
}
