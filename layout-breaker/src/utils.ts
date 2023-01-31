import { Resolution, ContainerList } from "./types";
import fs from "fs";
import { Page } from "puppeteer";

// FILES
export async function ensureFolderExists(path: string): Promise<any> {
  return fs.mkdir(path, { recursive: true }, (err) => {
    if (err) {
      //console.log(`Error while creating folder ${path}`, JSON.stringify(err));
      return;
    }
  });
}

interface GetFileNameParams {
  viewport?: Resolution;
  url?: string;
  prefix?: string;
  postfix: string;
}

export function getFileName({ viewport, url, prefix = "", postfix = "" }: GetFileNameParams): string {
  const resStr = viewport ? `${viewport.width}x${viewport.height}` : "";
  const hostname = url ? new URL(url).hostname : "";
  return [prefix, hostname, resStr, postfix].filter((x) => x).join("-");
}

//SCREENSHOTTING
export interface ScreenshotElementsParams {
  page: Page;
  elements: ContainerList; // TODO
  padding?: number;
  filepath: string;
}

export async function screenshotElements({ page, elements, filepath }: ScreenshotElementsParams): Promise<number> {
  const rects = await page.evaluate(async (elements) => {
    return Promise.all(
      Array.from(elements).map(async (elem: HTMLElement) => {
        const rect = await elem.getBoundingClientRect().toJSON();
        return rect as DOMRect;
      })
    );
  }, elements);

  await Promise.all(
    rects.map((rect, idx: number) => {
      screenshotRect(page, { rect, filepath: `${idx}-${filepath}` });
    })
  );
  return rects.length;
}

export interface ScreenshotRectParams {
  rect: DOMRect;
  padding?: number;
  filepath: string;
}
export async function screenshotRect(page: Page, { rect, filepath, padding = 2 }: ScreenshotRectParams): Promise<any> {
  const clip = {
    x: Math.max(0, rect.left - padding),
    y: Math.max(0, rect.top - padding),
    width: rect.width + padding * (rect.left > padding ? 2 : 1),
    height: rect.height + padding * (rect.top > padding ? 2 : 1)
  };
  return page
    .screenshot({
      clip,
      path: `${filepath}.png`
    })
    .catch((error: Error) => {
      console.error("Screenshot error. Filepath", filepath);
      console.error("Error", error);
    });
}
// const inRange = (value: number, range: [number, number]): boolean => value >= range[0] && value <= range[1];
