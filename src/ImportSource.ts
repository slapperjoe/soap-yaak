export class ImportSource {
  public sImport: string;
  public uri: URL;
  public fUrl: string;
  public fDir: string;
  public isWSDL: boolean;

  constructor(sImport: string) {
    this.sImport = sImport;
    this.uri = new URL(sImport);

    this.fUrl = this.uri.href.replace("?WSDL", ".wsdl").replace(":80", "");
    this.isWSDL = this.fUrl.endsWith(".wsdl");
    if (!this.isWSDL) this.fUrl += ".xsd";
    this.fDir = this.fUrl.substring(0, this.fUrl.lastIndexOf("/"))
  }
}
