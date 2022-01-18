import {CedarInputTemplate} from '../models/cedar-input-template.model';
import {TemplateComponent} from '../models/template/template-component.model';
import {MultiInstanceInfo} from '../models/info/multi-instance-info.model';
import {TemplateRepresentationFactory} from '../factory/template-representation.factory';
import {InstanceExtractData} from '../models/instance-extract-data.model';
import {InstanceFullData} from '../models/instance-full-data.model';
import {HandlerContext} from './handler-context';
import {MultiInstanceObjectHandler} from '../handler/multi-instance-object.handler';
import {DataObjectBuilderHandler} from '../handler/data-object-builder.handler';

export class DataContext {




  // DataContext will contain the individual page break template sections
  // as part of setInputTemplate, these sections must be built



  templateInput: CedarInputTemplate = null;
  templateRepresentation: TemplateComponent = null;



  instanceExtractData: InstanceExtractData = null;
  instanceFullData: InstanceFullData = null;
  multiInstanceData: MultiInstanceInfo = null;
  savedTemplateID: string;
  currentPBIndex: number;



  public constructor() {
  }


  setInputTemplate(value: object, handlerContext: HandlerContext, collapseStaticComponents: boolean): void {


    this.templateInput = value as CedarInputTemplate;
    this.templateRepresentation = TemplateRepresentationFactory.create(this.templateInput, collapseStaticComponents);

    const multiInstanceObjectService: MultiInstanceObjectHandler = handlerContext.multiInstanceObjectService;
    const dataObjectService: DataObjectBuilderHandler = handlerContext.dataObjectBuilderService;

    this.instanceExtractData = dataObjectService.buildNewExtractDataObject(this.templateRepresentation, this.templateInput);
    this.instanceFullData = dataObjectService.buildNewFullDataObject(this.templateRepresentation, this.templateInput);
    this.multiInstanceData = multiInstanceObjectService.buildNew(this.templateRepresentation);
    this.savedTemplateID = null;


    this.currentPBIndex = 0;





    console.log('***********************************');
    // console.log('templateInput');
    // console.log(this.templateInput);
    console.log('templateRepresentation children');
    console.log(this.templateRepresentation.children);


    console.log('pages');
    console.log(this.templateRepresentation.pageBreakChildren);


    console.log('has page breaks: ' + this.templateRepresentation.hasPageBreaks());

    console.log('***********************************');





  }










}
