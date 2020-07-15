import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-render-template',
  templateUrl: './render-template.component.html',
  styleUrls: ['./render-template.component.scss']
})
export class RenderTemplateComponent implements OnInit {

  public templateJson: object = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {
  }

  ngOnInit(): void {
    this.route.fragment.subscribe((fragment: string) => {
      const url = 'assets/templates/' + fragment.toString() + '/template.json';
      this.http.get(url).subscribe(value => {
         this.templateJson = value;
      });
    });
  }

}
