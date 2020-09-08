/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { Page } from "puppeteer";
import { ContainerList } from "./types";
import {
  getRandomInt as getRandomIntAlias,
  getRandomElement as getRandomElementAlias,
  screenshotRect as screenshotRectAlias
} from "./utils";

async function getRandomInt(min: number, max: number): Promise<number> {
  return await getRandomIntAlias(min, max);
}
async function getRandomElement(arr): Promise<string> {
  return await getRandomElementAlias(arr);
}

interface Params {
  page: Page;
  containers: ContainerList;
  filepath: string;
}

export async function generateOverlapScreenshots({ page, containers, filepath }: Params): Promise<number> {
  async function screenshotRect(params): Promise<string> {
    return screenshotRectAlias({ page, ...params });
  }

  await page.exposeFunction("getRandomInt", getRandomInt);
  await page.exposeFunction("getRandomElement", getRandomElement);
  await page.exposeFunction("screenshotRect", screenshotRect);

  return page.evaluate(
    async (containers, filepath) => {
      let count = 0;
      await Promise.all(
        containers.map(async (container: HTMLElement, idx: number) => {
          if (container.childElementCount <= 1) {
            return Promise.resolve();
          }

          //  randomly select child
          const randomChildIdx = await getRandomInt(0, container.childElementCount - 1);
          const child = container.children[randomChildIdx] as HTMLElement;
          const contRect = container.getBoundingClientRect().toJSON();
          const childRect = child.getBoundingClientRect().toJSON();
          const siblingFacingSide = await getSiblingFacingSide(contRect, childRect);

          preventFromExpanding(container, contRect);

          if (childRect.width > 0 && childRect.height > 0 && siblingFacingSide) {
            const { clientWidth } = document.documentElement;
            const offset: number = await getRandomInt(clientWidth / 25, clientWidth / 15);
            const prevMargin = child.style[`margin-${siblingFacingSide}`];
            child.style[`margin-${siblingFacingSide}`] = `-${offset}px`;
            count++;
            await screenshotRect({ rect: contRect, filepath: `${filepath}-${idx}` });
            //reset margin:
            child.style[`margin-${siblingFacingSide}`] = `${prevMargin}`;
          }
        })
      );
      return count;

      type Side = "top" | "bottom" | "right" | "left";

      async function getSiblingFacingSide(contRect: DOMRect, childRect: DOMRect): Promise<Side> {
        const notAligningSides = ["top", "left", "bottom", "right"].filter((side) => contRect[side] !== childRect[side]);
        return (await getRandomElement(notAligningSides)) as Side;
      }

      function preventFromExpanding(element: HTMLElement, rect: DOMRect): void {
        element.style["display"] = "block";
        element.style["max-width"] = `${rect.width}px`;
        element.style["width"] = `${rect.width}px`;
        element.style["max-height"] = `${rect.height}px`;
        element.style["height"] = `${rect.height}px`;
      }
    },
    containers,
    filepath
  );
}
