export type Resolution = {
  width: number;
  height: number;
};

export interface Sitedata {
  siteID: string;
  imagePath: string;
  resolution: Resolution;
  elements: Element[];
}

export type Rect = {
  x: number;
  y: number;
  bottom: number;
  top: number;
  right: number;
  left: number;
  height: number;
  width: number;
  area: number;
};

export interface GetSiteRequestParams {
  windowWidth: number;
}

export interface EvaluateSiteRequestParams {
  siteID: string;
  resolution: Resolution;
  selectedElementIDs: string[];
  viewport: Resolution;
}
