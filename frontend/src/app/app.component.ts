import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './Component/navbar/navbar.component';
import { FooterComponent } from './Component/footer/footer.component';
import { ThemeService } from './service/theme.service';
import { LanguageService } from './service/language.service';
import { AuthService } from './service/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'frontend';
  constructor(
    private themeService: ThemeService,
    private languageService: LanguageService,
    private authService: AuthService,
  ) {}
  ngOnInit(): void {
    this.themeService.init();
    this.languageService.init();
    // Restore authentication session on app initialization
    this.authService.restoreSession().subscribe();
  }
}
