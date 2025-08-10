export class ImportSource {
  public sImport: string;
  public uri: URL;
  public fUrl: string;
  public isWSDL: boolean;

  constructor(sImport: string) {
    this.sImport = sImport;
    this.uri = new URL(sImport);

    this.fUrl = this.uri.href.replace("?WSDL", ".wsdl").replace(":80", "");
    if (this.fUrl.endsWith(".wsdl")) {
      this.isWSDL = true;
    } else {
      this.isWSDL = false;
      this.fUrl += ".xsd"; 
    }
  }
}