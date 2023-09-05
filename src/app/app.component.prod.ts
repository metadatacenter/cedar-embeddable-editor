import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-component-prod',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponentProd implements OnInit {

  ceeConfig = {};

  languages = {
    selected: 'en',
    options: [{value: 'en', viewValue: 'en'}, {value: 'hu', viewValue: 'hu'}]
  };

  constructor() {
  }

  ngOnInit(): void {
  }

  // getCurrentLanguageCode() {
  //   return this.translateService.currentLang;
  // }
  //
  // switchLanguage($event: any, language: string) {
  //   $event.preventDefault();
  //   this.translateService.use(language);
  //   this.localSettings.setLanguage(language);
  // }
  //
  // setLanguage(language: string) {
  //   this.translateService.use(language);
  //   this.localSettings.setLanguage(language);
  // }

}
