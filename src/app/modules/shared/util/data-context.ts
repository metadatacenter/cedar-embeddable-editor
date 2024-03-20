import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { MultiInstanceInfo } from '../models/info/multi-instance-info.model';
import { TemplateRepresentationFactory } from '../factory/template-representation.factory';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { InstanceFullData } from '../models/instance-full-data.model';
import { HandlerContext } from './handler-context';
import { MultiInstanceObjectHandler } from '../handler/multi-instance-object.handler';
import { DataObjectBuilderHandler } from '../handler/data-object-builder.handler';
import { PageBreakPaginatorService } from '../service/page-break-paginator.service';
import { DataQualityReport } from '../models/data-quality-report.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { ElementComponent } from '../models/component/element-component.model';

export class DataContext {
  templateInput: CedarInputTemplate = null;
  templateRepresentation: TemplateComponent = null;
  instanceExtractData: InstanceExtractData = null;
  instanceFullData: InstanceFullData = null;
  multiInstanceData: MultiInstanceInfo = null;
  dataQualityReport: DataQualityReport = null;
  savedTemplateID: string;

  public constructor() {}

  setInputTemplate(
    value: object,
    handlerContext: HandlerContext,
    pageBreakPaginatorService: PageBreakPaginatorService,
    collapseStaticComponents: boolean,
  ): void {
    this.templateInput = value as CedarInputTemplate;
    this.templateRepresentation = TemplateRepresentationFactory.create(
      this.templateInput,
      collapseStaticComponents,
      handlerContext,
    );
    pageBreakPaginatorService.reset(this.templateRepresentation.pageBreakChildren);
    const multiInstanceObjectService: MultiInstanceObjectHandler = handlerContext.multiInstanceObjectService;
    //If instance was passed these are extracted from instance. No need to do it from template
    if (this.instanceExtractData === null || this.instanceFullData === null) {
      const dataObjectService: DataObjectBuilderHandler = handlerContext.dataObjectBuilderService;
      this.instanceExtractData = dataObjectService.buildNewExtractDataObject(
        this.templateRepresentation,
        this.templateInput,
      );
      this.instanceFullData = dataObjectService.buildNewFullDataObject(this.templateRepresentation, this.templateInput);
      this.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(this.templateRepresentation);
    } else {
      this.multiInstanceData = multiInstanceObjectService.buildNewOrFromMetadata(
        this.templateRepresentation,
        handlerContext.dataContext.instanceExtractData,
      );
    }
    this.savedTemplateID = null;
    if (!handlerContext.readOnlyMode) {
      handlerContext.buildQualityReport();
    }
  }
}
