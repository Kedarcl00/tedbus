import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataserviceService } from '../../service/dataservice.service';
import { BusService } from '../../service/bus.service';
import { BookingService } from '../../service/booking.service';
import { AuthService } from '../../service/auth.service';
import { FareCalculationService } from '../../service/fare-calculation.service';

@Component({
  selector: 'app-payment-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, TranslateModule],
  templateUrl: './payment-page.component.html',
  styleUrl: './payment-page.component.css',
})
export class PaymentPageComponent implements OnInit {
  passseatarray: any[] = [];
  passfare: number = 0;
  routedetails: any = [];
  busdepauturetime: string = '';
  busarrivaltime: string = '';
  customerid: any = {};
  operatorname: string = '';
  passengerdetails: any = [];
  email: string = '';
  fare: number = 0;
  busid: string = '';
  phonenumber: string = '';
  departuredetails: any = {};
  arrivaldetails: any = {};
  duration: string = '';
  isbuisnesstravel: boolean = false;
  isinsurance: boolean = false;
  iscoviddonated: boolean = false;
  bookingdate: string = new Date().toISOString().split('T')[0];
  selecteddate: string = '';  // Add selecteddate field
  
  // Receipt data
  showReceipt: boolean = false;
  receiptHTML: string = '';
  receiptData: any = null;
  
  // Payment method selector properties
  selectedPaymentMethod: 'online' | 'cash_on_trip' = 'online';
  isSubmitting: boolean = false;
  errorMessage: string = '';
  routeId: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataservice: DataserviceService,
    private busservice: BusService,
    private bookingService: BookingService,
    private authservice: AuthService,
    private fareService: FareCalculationService,
  ) {}

  ngOnInit(): void {
    // AuthGuard already redirects unauthenticated users, but keep a
    // defensive check for any edge case (e.g. sessionStorage cleared mid-session).
    const user = this.authservice.currentUser;
    if (!user) {
      this.router.navigate(['/']);
      return;
    }
    this.customerid = user;

    this.route.params.subscribe(params => {
      this.operatorname = params['operatorname'];
      const rawSeats = params['selectedseat'];
      if (Array.isArray(rawSeats)) {
        this.passseatarray = rawSeats.map(Number);
      } else if (typeof rawSeats === 'string' && rawSeats) {
        this.passseatarray = rawSeats.split(',').map(Number).filter((n: number) => !isNaN(n));
      } else {
        this.passseatarray = [];
      }
      this.email = params['passemail'];
      this.phonenumber = params['passphn'];
      this.isbuisnesstravel = params['passisbuisness'];
      this.isinsurance = params['passinsurance'];
      this.passfare = parseFloat(params['seatprice']) || 0;
      this.busid = params['busid'];
      this.busarrivaltime = params['busarrivaltime'];
      this.busdepauturetime = params['busdeparturetime'];
      this.iscoviddonated = params['passiscoviddonate'];
      this.routeId = params['routeid'] || '';
      this.selecteddate = params['selecteddate'] || '';  // Read selecteddate from params
    });

    this.dataservice.currentdata.subscribe(data => {
      this.routedetails = data;
      // Extract routeId from route details if not in params
      if (data && data._id && !this.routeId) {
        this.routeId = data._id;
      }
    });

    this.dataservice.passdata.subscribe(data => {
      this.passengerdetails = data;
    });
  }

  makepayment(): void {
    const user = this.authservice.currentUser;
    if (!user) {
      this.router.navigate(['/']);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    // If passengers not provided, generate placeholder passengers based on seat count
    let passengers = this.passengerdetails && this.passengerdetails.length > 0 
      ? this.passengerdetails 
      : this.generatePlaceholderPassengers();

    // Create booking payload with all required fields (Plan Fix 1)
    const bookingData = {
      busId: this.busid,
      routeId: this.routeId,
      seats: this.passseatarray,
      fare: this.passfare,
      paymentMethod: this.selectedPaymentMethod,
      departureDate: this.selecteddate,
      passengers: passengers,  // Match backend field name: passengers not passengerDetails
      phoneNumber: this.phonenumber,
      departureDetails: {
        city: this.routedetails?.departureLocation?.city || '',
        location: this.routedetails?.departureLocation?.address || '',
        date: this.selecteddate,
        time: this.busdepauturetime,
      },
      arrivalDetails: {
        city: this.routedetails?.arrivalLocation?.city || '',
        location: this.routedetails?.arrivalLocation?.address || '',
        date: this.selecteddate,
        time: this.busarrivaltime,
      },
      duration: this.duration || this.routedetails?.duration || '',
    };

    // Call BookingService.createBooking() instead of busservice.addbusmongo()
    this.bookingService.createBooking(bookingData).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        console.log('Booking created successfully', response);
        
        // Store booking data for receipt generation
        // Response might have booking inside (from success wrapper) or be the booking directly
        const bookingResponse = (response as any).booking || response;
        this.receiptData = bookingResponse;
        
        // Generate receipt HTML
        this.receiptHTML = this.generateReceiptHTML();
        
        // Show receipt instead of alert
        this.showReceipt = true;
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Booking failed', error);
        // Show error message to user
        this.errorMessage = error.message || 'Failed to create booking. Please try again.';
        alert(`Booking failed: ${this.errorMessage}`);
      },
    });
  }

  downloadReceipt(): void {
    if (!this.receiptHTML) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(this.receiptHTML);
      printWindow.document.close();
      
      // Trigger print dialog
      setTimeout(() => {
        printWindow.print();
        // Note: User can choose "Save as PDF" in the print dialog
      }, 250);
    }
  }

  private generatePlaceholderPassengers(): any[] {
    // Generate placeholder passengers based on number of seats selected
    const seatCount = this.passseatarray?.length || 1;
    const passengers = [];
    
    for (let i = 0; i < seatCount; i++) {
      passengers.push({
        name: `Passenger ${i + 1}`,
        age: 25,
        gender: 'Not Specified',
        phone: this.phonenumber || ''
      });
    }
    
    return passengers;
  }

  private generateReceiptHTML(): string {
    const r = this.receiptData;
    const passengerList = r.passengers?.map((p: any) => 
      `<tr><td>${p.name}</td><td>${p.age}</td><td>${p.gender}</td></tr>`
    ).join('') || '';
    
    const seatsList = r.seats?.join(', ') || 'N/A';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Booking Receipt - ${r.bookingReference}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            background: white;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 3px solid #d32f2f;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .receipt-header h1 {
            color: #d32f2f;
            margin: 0;
          }
          .receipt-header p {
            margin: 5px 0;
            color: #666;
          }
          .booking-ref {
            background: #f5f5f5;
            padding: 15px;
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin: 20px 0;
            border-left: 4px solid #d32f2f;
          }
          .section {
            margin: 20px 0;
          }
          .section-title {
            background: #d32f2f;
            color: white;
            padding: 10px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding: 10px;
          }
          .detail-item {
            padding: 8px;
            border-bottom: 1px solid #eee;
          }
          .detail-label {
            font-weight: bold;
            color: #666;
            font-size: 12px;
          }
          .detail-value {
            color: #333;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          th {
            background: #f5f5f5;
            font-weight: bold;
          }
          .fare-section {
            background: #fff3cd;
            padding: 15px;
            margin: 20px 0;
            border-left: 4px solid #ffc107;
          }
          .fare-total {
            font-size: 24px;
            font-weight: bold;
            color: #d32f2f;
            text-align: right;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>🚌 TedBus - Booking Receipt</h1>
          <p>Your journey, our commitment</p>
        </div>

        <div class="booking-ref">
          Booking Reference: ${r.bookingReference}
        </div>

        <div class="section">
          <div class="section-title">Customer Information</div>
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-label">Name</div>
              <div class="detail-value">${this.authservice.currentUser?.name || 'Guest'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Email</div>
              <div class="detail-value">${this.authservice.currentUser?.email || ''}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Booking Date</div>
              <div class="detail-value">${new Date(r.createdAt).toLocaleString()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Payment Method</div>
              <div class="detail-value">${r.paymentMethod === 'cash_on_trip' ? 'Cash on Trip' : 'Online Payment'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Journey Details</div>
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-label">From</div>
              <div class="detail-value">${r.departureLocation?.name || this.routedetails?.departureLocation?.name || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">To</div>
              <div class="detail-value">${r.arrivalLocation?.name || this.routedetails?.arrivalLocation?.name || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Journey Date</div>
              <div class="detail-value">${r.journeyDate || this.selecteddate}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Distance</div>
              <div class="detail-value">${r.totalDistance || 0} km</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Departure Time</div>
              <div class="detail-value">${r.departureTime || this.busdepauturetime}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Arrival Time</div>
              <div class="detail-value">${r.arrivalTime || this.busarrivaltime}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Duration</div>
              <div class="detail-value">${r.duration || this.routedetails?.duration || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Seat Numbers</div>
              <div class="detail-value">${seatsList}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Bus Information</div>
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-label">Operator</div>
              <div class="detail-value">${r.busId?.operatorName || this.operatorname || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Bus Type</div>
              <div class="detail-value">${r.busId?.busType || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Registration</div>
              <div class="detail-value">${r.busId?.registrationNumber || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Amenities</div>
              <div class="detail-value">${r.busId?.amenities?.join(', ') || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Passenger Details</div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
              </tr>
            </thead>
            <tbody>
              ${passengerList}
            </tbody>
          </table>
        </div>

        <div class="fare-section">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 16px; font-weight: bold;">Total Fare</div>
              <div style="font-size: 12px; color: #666;">Including all taxes</div>
            </div>
            <div class="fare-total">₹${r.fare?.toFixed(2) || '0.00'}</div>
          </div>
        </div>

        <div class="footer">
          <p><strong>Important Information:</strong></p>
          <p>Please carry a valid ID proof during your journey.</p>
          <p>Report at the boarding point 15 minutes before departure.</p>
          ${r.paymentMethod === 'cash_on_trip' ? '<p><strong>Payment Mode:</strong> Please pay ₹' + r.fare?.toFixed(2) + ' in cash to the bus conductor.</p>' : ''}
          <p style="margin-top: 15px;">Thank you for choosing TedBus! Have a safe journey.</p>
          <p style="margin-top: 5px;">For support, contact: support@tedbus.com | +91-1800-XXX-XXXX</p>
        </div>
      </body>
      </html>
    `;
  }

  closeReceipt(): void {
    this.showReceipt = false;
    this.router.navigate(['/profile']);
  }
}
