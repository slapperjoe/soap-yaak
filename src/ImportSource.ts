import { createHash } from 'node:crypto';

export class ImportSource {
  public sImport: string;
  public uri: URL;
  public fUrl: string;
  public fDir: string;
  public isWSDL: boolean;
  public guid: string;
  public gFile: string;

  static fileCount: number = 1;

  

  public countFile: string;

  public hashFile: string;

  constructor(sImport: string) {
    this.sImport = sImport;
    this.uri = new URL(sImport);
    this.guid = crypto.randomUUID();

    this.fUrl = this.uri.href.replace("?WSDL", ".wsdl").replace(":80", "");
    this.isWSDL = this.fUrl.endsWith(".wsdl");
    if (!this.isWSDL) this.fUrl += ".xsd";
    this.fDir = this.fUrl.substring(0, this.fUrl.lastIndexOf("/"))

    this.gFile = this.guid + (this.isWSDL ? ".wsdl" : ".xsd");
    this.countFile = ImportSource.fileCount.toString() + (this.isWSDL ? ".wsdl" : ".xsd"); 
    const hash = createHash('sha256')
    hash.update(sImport);

    this.hashFile = hash.digest('hex') + (this.isWSDL ? ".wsdl" : ".xsd"); 
    ImportSource.fileCount++;
  }

  get portlessUrl(): string {
    return this.sImport.replace(":80", "");
  } 
}
