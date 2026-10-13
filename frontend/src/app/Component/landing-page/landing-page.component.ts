import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';
import { DialogComponent } from './dialog/dialog.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    TranslateModule,
    DialogComponent,
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
})
export class LandingPageComponent {
  fromoption: string = '';
  tooption: string = '';
  date: string = '';

  constructor(private router: Router, public dialog: MatDialog) {}

  fromEvent(option: string) {
    this.fromoption = option;
  }

  toEvent(option: string) {
    this.tooption = option;
  }

  matchDate(event: any) {
    if (event.value) {
      const date = new Date(event.value);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString();
      this.date = `${year}-${month}-${day}`;
    } else {
      this.date = 'null';
    }
  }

  submit() {
    if (this.fromoption && this.tooption && this.date) {
      const validRoutes: [string, string][] = [
        ['Delhi', 'Jaipur'],
        ['Mumbai', 'Goa'],
        ['Bangalore', 'Mysore'],
        ['Kolkata', 'Darjeeling'],
        ['Chennai', 'Pondicherry'],
      ];
      const isValid = validRoutes.some(
        ([from, to]) => this.fromoption === from && this.tooption === to
      );
      if (isValid) {
        this.router.navigate(['/select-bus'], {
          queryParams: {
            departure: this.fromoption,
            arrival: this.tooption,
            date: this.date,
          },
        });
      } else {
        const dialogRef = this.dialog.open(DialogComponent);
        dialogRef.afterClosed().subscribe(result => {
          console.log(`Dialog result: ${result}`);
        });
      }
    } else {
      alert('fill up the details!!!');
    }
  }
}
