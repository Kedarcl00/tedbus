import { Component } from '@angular/core';
import { HeaderComponent } from './header/header.component';
import { LeftComponent } from './left/left.component';
import { RightComponent } from './right/right.component';

@Component({
  selector: 'app-selectbus-page',
  standalone: true,
  imports: [HeaderComponent, LeftComponent, RightComponent],
  templateUrl: './selectbus-page.component.html',
  styleUrl: './selectbus-page.component.css',
})
export class SelectbusPageComponent {}
