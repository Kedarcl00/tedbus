import { Injectable } from '@angular/core';

export interface FareBreakdown {
  baseFarePerSeat: number;
  numberOfSeats: number;
  subtotal: number;
  taxes: number;
  discounts: number;
  totalFare: number;
}

/**
 * FareCalculationService - Centralized service for fare calculations
 *
 * Ensures consistent fare calculations across all booking pages:
 * - Bus selection (display base fare)
 * - Seat selection (calculate total for selected seats)
 * - Payment page (display fare breakdown)
 *
 * Supports:
 * - Per-seat base fare calculation
 * - Multi-seat total calculation
 * - Tax calculations
 * - Discount applications
 */
@Injectable({
  providedIn: 'root'
})
export class FareCalculationService {

  constructor() { }

  /**
   * Calculate complete fare breakdown for a booking
   *
   * @param baseFarePerSeat - Base price per seat
   * @param numberOfSeats - Number of seats selected
   * @param taxes - Optional tax amount (default 0)
   * @param discounts - Optional discount amount (default 0)
   * @returns FareBreakdown with all fare details
   *
   * Example:
   * calculateFare(100, 3, 15, 0) =>
   * { baseFarePerSeat: 100, numberOfSeats: 3, subtotal: 300, taxes: 15, discounts: 0, totalFare: 315 }
   */
  calculateFare(
    baseFarePerSeat: number,
    numberOfSeats: number,
    taxes: number = 0,
    discounts: number = 0
  ): FareBreakdown {
    const subtotal = baseFarePerSeat * numberOfSeats;
    const totalFare = subtotal + taxes - discounts;

    return {
      baseFarePerSeat,
      numberOfSeats,
      subtotal,
      taxes,
      discounts,
      totalFare: Math.max(0, totalFare) // Ensure non-negative total
    };
  }

  /**
   * Calculate base fare per seat based on bus type and route duration
   * Uses the same formula as bus-box component for consistency
   *
   * @param busType - Type of bus (standard, sleeper, A/C Seater, Non-A/C)
   * @param durationHours - Journey duration in hours
   * @returns Base fare per seat
   *
   * Formula: (ratePerHour * durationHours) / 2
   * - standard: ₹50/hour
   * - sleeper: ₹100/hour
   * - A/C Seater: ₹125/hour
   * - Non-A/C: ₹75/hour
   */
  calculateBaseFarePerSeat(busType: string, durationHours: number): number {
    let ratePerHour = 75; // Default Non-A/C rate

    if (busType === 'standard') {
      ratePerHour = 50;
    } else if (busType === 'sleeper') {
      ratePerHour = 100;
    } else if (busType === 'A/C Seater' || busType === 'AC Seater') {
      ratePerHour = 125;
    }

    const baseFare = (ratePerHour * durationHours) / 2;
    return Math.ceil(baseFare); // Round up to nearest rupee
  }

  /**
   * Format currency as Indian Rupees
   *
   * @param amount - Amount in rupees
   * @returns Formatted string with currency symbol
   */
  formatCurrency(amount: number): string {
    return `₹${amount.toFixed(2)}`;
  }
}
