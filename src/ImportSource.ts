import { createHash } from 'node:crypto';

export class ImportSource {
  public sImport: string;
  public uri: URL;
  public fUrl: string;
  public isWSDL: boolean;
  public guid: string;

  public hashFile: string;

  constructor(sImport: string) {
    this.sImport = sImport;
    this.uri = new URL(sImport);
    this.guid = crypto.randomUUID();

    this.fUrl = this.uri.href.replace("?WSDL", ".wsdl").replace(":80", "");
    this.isWSDL = this.fUrl.endsWith(".wsdl");
    if (!this.isWSDL) this.fUrl += ".xsd";

    const hash = createHash('sha256')
    hash.update(sImport);

    this.hashFile = hash.digest('hex') + (this.isWSDL ? ".wsdl" : ".xsd"); 
  }

  get portlessUrl(): string {
    return this.sImport.replace(":80", "");
  } 
}
