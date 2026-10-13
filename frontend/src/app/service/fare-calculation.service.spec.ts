import { TestBed } from '@angular/core/testing';
import { FareCalculationService, FareBreakdown } from './fare-calculation.service';

describe('FareCalculationService', () => {
  let service: FareCalculationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FareCalculationService]
    });
    service = TestBed.inject(FareCalculationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculateFare()', () => {
    it('should calculate fare correctly for single seat', () => {
      const result = service.calculateFare(100, 1, 0, 0);
      expect(result.baseFarePerSeat).toBe(100);
      expect(result.numberOfSeats).toBe(1);
      expect(result.subtotal).toBe(100);
      expect(result.taxes).toBe(0);
      expect(result.discounts).toBe(0);
      expect(result.totalFare).toBe(100);
    });

    it('should calculate fare correctly for multiple seats', () => {
      const result = service.calculateFare(100, 3, 0, 0);
      expect(result.baseFarePerSeat).toBe(100);
      expect(result.numberOfSeats).toBe(3);
      expect(result.subtotal).toBe(300);
      expect(result.taxes).toBe(0);
      expect(result.discounts).toBe(0);
      expect(result.totalFare).toBe(300);
    });

    it('should calculate fare with taxes', () => {
      const result = service.calculateFare(100, 2, 25, 0);
      expect(result.subtotal).toBe(200);
      expect(result.taxes).toBe(25);
      expect(result.totalFare).toBe(225);
    });

    it('should calculate fare with discounts', () => {
      const result = service.calculateFare(100, 2, 0, 50);
      expect(result.subtotal).toBe(200);
      expect(result.discounts).toBe(50);
      expect(result.totalFare).toBe(150);
    });

    it('should calculate fare with both taxes and discounts', () => {
      const result = service.calculateFare(100, 2, 30, 20);
      expect(result.subtotal).toBe(200);
      expect(result.taxes).toBe(30);
      expect(result.discounts).toBe(20);
      expect(result.totalFare).toBe(210);
    });

    it('should ensure total fare is non-negative', () => {
      const result = service.calculateFare(100, 1, 0, 200);
      expect(result.totalFare).toBe(0);
    });

    it('should handle decimal fares', () => {
      const result = service.calculateFare(99.99, 2, 15.50, 10.50);
      expect(result.subtotal).toBe(199.98);
      expect(result.taxes).toBe(15.50);
      expect(result.discounts).toBe(10.50);
      expect(result.totalFare).toBe(204.98);
    });

    it('should handle zero inputs', () => {
      const result = service.calculateFare(0, 0, 0, 0);
      expect(result.totalFare).toBe(0);
    });
  });

  describe('calculateBaseFarePerSeat()', () => {
    it('should calculate fare for standard bus type', () => {
      // standard: ₹50/hour, formula: (50 * 8) / 2 = 200
      const fare = service.calculateBaseFarePerSeat('standard', 8);
      expect(fare).toBe(200);
    });

    it('should calculate fare for sleeper bus type', () => {
      // sleeper: ₹100/hour, formula: (100 * 6) / 2 = 300
      const fare = service.calculateBaseFarePerSeat('sleeper', 6);
      expect(fare).toBe(300);
    });

    it('should calculate fare for A/C Seater bus type', () => {
      // A/C Seater: ₹125/hour, formula: (125 * 8) / 2 = 500
      const fare = service.calculateBaseFarePerSeat('A/C Seater', 8);
      expect(fare).toBe(500);
    });

    it('should calculate fare for AC Seater bus type (alternative)', () => {
      // AC Seater (alternative name): ₹125/hour, formula: (125 * 8) / 2 = 500
      const fare = service.calculateBaseFarePerSeat('AC Seater', 8);
      expect(fare).toBe(500);
    });

    it('should calculate fare for Non-A/C bus type', () => {
      // Non-A/C: ₹75/hour (default), formula: (75 * 10) / 2 = 375
      const fare = service.calculateBaseFarePerSeat('Non-A/C', 10);
      expect(fare).toBe(375);
    });

    it('should use default rate for unknown bus type', () => {
      // Unknown type defaults to ₹75/hour, formula: (75 * 4) / 2 = 150
      const fare = service.calculateBaseFarePerSeat('unknown', 4);
      expect(fare).toBe(150);
    });

    it('should round up fractional fares', () => {
      // ₹50/hour * 3.5h / 2 = 87.5 → rounds up to 88
      const fare = service.calculateBaseFarePerSeat('standard', 3.5);
      expect(fare).toBe(88);
    });

    it('should handle decimal durations', () => {
      // ₹100/hour * 2.5h / 2 = 125
      const fare = service.calculateBaseFarePerSeat('sleeper', 2.5);
      expect(fare).toBe(125);
    });

    it('should handle very short journeys', () => {
      // ₹50/hour * 0.5h / 2 = 12.5 → rounds up to 13
      const fare = service.calculateBaseFarePerSeat('standard', 0.5);
      expect(fare).toBe(13);
    });

    it('should handle long journeys', () => {
      // ₹100/hour * 24h / 2 = 1200
      const fare = service.calculateBaseFarePerSeat('sleeper', 24);
      expect(fare).toBe(1200);
    });
  });

  describe('formatCurrency()', () => {
    it('should format integer amounts', () => {
      expect(service.formatCurrency(100)).toBe('₹100.00');
    });

    it('should format decimal amounts', () => {
      expect(service.formatCurrency(99.99)).toBe('₹99.99');
    });

    it('should format zero', () => {
      expect(service.formatCurrency(0)).toBe('₹0.00');
    });

    it('should format large amounts', () => {
      expect(service.formatCurrency(10000)).toBe('₹10000.00');
    });
  });

  describe('integration', () => {
    it('should calculate complete fare breakdown for a multi-seat booking', () => {
      // Calculate base fare and then total
      const baseFare = service.calculateBaseFarePerSeat('standard', 8);
      const breakdown = service.calculateFare(baseFare, 2, 50, 0);

      expect(breakdown.baseFarePerSeat).toBe(200);
      expect(breakdown.numberOfSeats).toBe(2);
      expect(breakdown.subtotal).toBe(400);
      expect(breakdown.taxes).toBe(50);
      expect(breakdown.totalFare).toBe(450);
    });

    it('should apply discount after taxes', () => {
      const baseFare = service.calculateBaseFarePerSeat('sleeper', 6);
      const breakdown = service.calculateFare(baseFare, 1, 30, 50);

      expect(breakdown.baseFarePerSeat).toBe(300);
      expect(breakdown.subtotal).toBe(300);
      expect(breakdown.taxes).toBe(30);
      expect(breakdown.discounts).toBe(50);
      expect(breakdown.totalFare).toBe(280);
    });
  });
});
