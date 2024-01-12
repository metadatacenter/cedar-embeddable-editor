import { TemplateComponent } from '../models/template/template-component.model';
import { DataQualityReport } from '../models/data-quality-report.model';
import { DataContext } from '../util/data-context';

export class DataQualityReportBuilderHandler {
  private dataObjectFull: object;
  private templateRepresentation: TemplateComponent;
  private report: DataQualityReport;

  buildReport(dataContext: DataContext): DataQualityReport {
    this.report = new DataQualityReport();
    console.log(dataContext.templateRepresentation);
    console.log(dataContext.instanceFullData);
    this.report.templateRepresentation = dataContext.templateRepresentation;
    this.report.instanceFullData = dataContext.instanceFullData;
    return this.report;
  }
}
