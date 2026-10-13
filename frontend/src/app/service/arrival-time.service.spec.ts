import { TestBed } from '@angular/core/testing';
import { ArrivalTimeService, ArrivalTimeResult } from './arrival-time.service';

describe('ArrivalTimeService', () => {
  let service: ArrivalTimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ArrivalTimeService]
    });
    service = TestBed.inject(ArrivalTimeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculateArrivalTime()', () => {
    it('should calculate same-day arrival correctly', () => {
      const result = service.calculateArrivalTime('09:00', 8);
      expect(result.time).toBe('17:00');
      expect(result.nextDay).toBe(false);
    });

    it('should calculate cross-midnight arrival correctly', () => {
      const result = service.calculateArrivalTime('23:00', 3);
      expect(result.time).toBe('02:00');
      expect(result.nextDay).toBe(true);
    });

    it('should calculate exactly midnight arrival', () => {
      const result = service.calculateArrivalTime('00:00', 24);
      expect(result.time).toBe('00:00');
      expect(result.nextDay).toBe(true);
    });

    it('should calculate decimal duration correctly', () => {
      const result = service.calculateArrivalTime('14:30', 2.5);
      expect(result.time).toBe('17:00');
      expect(result.nextDay).toBe(false);
    });

    it('should handle minute-only durations', () => {
      const result = service.calculateArrivalTime('14:30', 0.5);
      expect(result.time).toBe('15:00');
      expect(result.nextDay).toBe(false);
    });

    it('should handle zero duration', () => {
      const result = service.calculateArrivalTime('14:30', 0);
      expect(result.time).toBe('14:30');
      expect(result.nextDay).toBe(false);
    });

    it('should handle very long journeys', () => {
      const result = service.calculateArrivalTime('10:00', 48);
      expect(result.nextDay).toBe(true);
    });

    it('should use provided actual arrival time over calculation', () => {
      const result = service.calculateArrivalTime('09:00', 8, '17:30');
      expect(result.time).toBe('17:30');
    });

    it('should detect next day when actual arrival time is provided', () => {
      // Departure 23:00, arrival 02:00 (next day)
      const result = service.calculateArrivalTime('23:00', 3, '02:00');
      expect(result.time).toBe('02:00');
      expect(result.nextDay).toBe(true);
    });

    it('should return same day for provided arrival time when hours increase', () => {
      // Departure 10:00, arrival 18:00 (same day)
      const result = service.calculateArrivalTime('10:00', 100, '18:00');
      expect(result.time).toBe('18:00');
      expect(result.nextDay).toBe(false);
    });

    it('should handle invalid departure time', () => {
      const result = service.calculateArrivalTime('invalid', 8);
      expect(result.time).toBe('Invalid time');
      expect(result.nextDay).toBe(false);
    });

    it('should handle empty departure time', () => {
      const result = service.calculateArrivalTime('', 8);
      expect(result.time).toBe('Invalid time');
      expect(result.nextDay).toBe(false);
    });

    it('should handle malformed time strings', () => {
      const result = service.calculateArrivalTime('25:99', 8);
      expect(result.time).toBe('Invalid time');
      expect(result.nextDay).toBe(false);
    });

    it('should ignore empty actual arrival time and calculate instead', () => {
      const result = service.calculateArrivalTime('09:00', 8, '');
      expect(result.time).toBe('17:00');
      expect(result.nextDay).toBe(false);
    });

    it('should ignore whitespace-only actual arrival time', () => {
      const result = service.calculateArrivalTime('09:00', 8, '   ');
      expect(result.time).toBe('17:00');
      expect(result.nextDay).toBe(false);
    });

    it('should calculate arrival at edge of day boundaries', () => {
      const result = service.calculateArrivalTime('23:00', 1);
      expect(result.time).toBe('00:00');
      expect(result.nextDay).toBe(true);
    });

    it('should handle fractional hours correctly', () => {
      // 10:00 + 3.75h (3h 45m) = 13:45
      const result = service.calculateArrivalTime('10:00', 3.75);
      expect(result.time).toBe('13:45');
      expect(result.nextDay).toBe(false);
    });

    it('should round duration minutes correctly', () => {
      // 10:00 + 3.25h (3h 15m) = 13:15
      const result = service.calculateArrivalTime('10:00', 3.25);
      expect(result.time).toBe('13:15');
      expect(result.nextDay).toBe(false);
    });
  });

  describe('getDisplayString()', () => {
    it('should display same-day arrival without indicator', () => {
      const display = service.getDisplayString('17:00', false);
      expect(display).toBe('17:00');
    });

    it('should display next-day arrival with indicator', () => {
      const display = service.getDisplayString('02:00', true);
      expect(display).toBe('02:00 (+1 day)');
    });
  });

  describe('calculateDuration()', () => {
    it('should calculate same-day duration correctly', () => {
      const duration = service.calculateDuration('09:00', '17:00', false);
      expect(duration).toBe('8h');
    });

    it('should calculate cross-midnight duration correctly', () => {
      const duration = service.calculateDuration('23:00', '02:00', true);
      expect(duration).toBe('3h');
    });

    it('should calculate duration with minutes', () => {
      const duration = service.calculateDuration('14:30', '17:15', false);
      expect(duration).toBe('2h 45m');
    });

    it('should calculate duration for minutes only', () => {
      const duration = service.calculateDuration('14:30', '15:00', false);
      expect(duration).toBe('30m');
    });

    it('should handle invalid departure time', () => {
      const duration = service.calculateDuration('invalid', '17:00', false);
      expect(duration).toBe('Unknown');
    });

    it('should handle invalid arrival time', () => {
      const duration = service.calculateDuration('09:00', 'invalid', false);
      expect(duration).toBe('Unknown');
    });

    it('should calculate long journey duration', () => {
      const duration = service.calculateDuration('10:00', '10:00', true);
      expect(duration).toBe('24h');
    });

    it('should calculate duration across multiple days', () => {
      // From 22:00 to 02:00 next day = 4h
      const duration = service.calculateDuration('22:00', '02:00', true);
      expect(duration).toBe('4h');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete journey workflow: calculate then display', () => {
      // Calculate arrival
      const arrival = service.calculateArrivalTime('23:00', 3);
      expect(arrival.time).toBe('02:00');
      expect(arrival.nextDay).toBe(true);

      // Get display string
      const display = service.getDisplayString(arrival.time, arrival.nextDay);
      expect(display).toBe('02:00 (+1 day)');

      // Calculate duration
      const duration = service.calculateDuration('23:00', arrival.time, arrival.nextDay);
      expect(duration).toBe('3h');
    });

    it('should handle overnight journey with provided arrival time', () => {
      const arrival = service.calculateArrivalTime('22:00', 100, '06:00');
      expect(arrival.time).toBe('06:00');
      expect(arrival.nextDay).toBe(true);

      const display = service.getDisplayString(arrival.time, arrival.nextDay);
      expect(display).toBe('06:00 (+1 day)');
    });

    it('should handle early morning departure', () => {
      const arrival = service.calculateArrivalTime('05:00', 4);
      expect(arrival.time).toBe('09:00');
      expect(arrival.nextDay).toBe(false);

      const display = service.getDisplayString(arrival.time, arrival.nextDay);
      expect(display).toBe('09:00');
    });

    it('should maintain consistency: provided time overrides calculation', () => {
      // Calculated: 09:00 + 8h = 17:00
      // Provided: 17:30 (different)
      const arrival = service.calculateArrivalTime('09:00', 8, '17:30');
      expect(arrival.time).toBe('17:30');
      expect(arrival.nextDay).toBe(false);
    });
  });
});
