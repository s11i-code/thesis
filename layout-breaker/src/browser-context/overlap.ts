/* eslint-disable @typescript-eslint/ban-ts-ignore */

import { Page } from "puppeteer";
import { ContainerList } from "../types";

type Direction = "vertical" | "horizontal";
type Side = "top" | "bottom" | "right" | "left";

export interface Params {
  page: Page;
  containers: ContainerList;
}

export async function generateOverlapScreenshots(params: Params): Promise<number> {
  return params.page.evaluate(async (containers) => {
    let count = 0;

    await Promise.all(
      Array.from(containers).map(async (container: HTMLElement, idx: number) => {
        //@ts-ignore
        const randomChildIdx = getRandomInt(0, container.childElementCount - 1);
        const child = container.children[randomChildIdx] as HTMLElement;
        const childCount = container.childElementCount;
        if (childCount <= 1) {
          return Promise.resolve();
        }
        //@ts-ignore Cannot find name 'isVisibleInDOM'.ts(2304)
        if (!isVisibleInDOM(child)) {
          return Promise.resolve();
        }

        const contRect = container.getBoundingClientRect().toJSON();
        const layoutDirection = getLayoutDirection(container);
        const siblingFacingSide = getSiblingFacingSide(randomChildIdx === 0, randomChildIdx === childCount, layoutDirection);

        //@ts-ignore Cannot find name 'fixDimensions'.ts(2304)
        fixDimensions(container, contRect);
        const { clientWidth } = document.documentElement;

        //@ts-ignore
        const offset: number = getRandomInt(clientWidth / 20, clientWidth / 15);
        const prevMargin = child.style[`margin-${siblingFacingSide}`];
        const { display: prevDisplay } = child.style;
        child.style[`margin-${siblingFacingSide}`] = `-${offset}px`;
        child.style.display = `inline-block`;
        count++;
        //@ts-ignore 'Cannot find namescreenshotRect'
        await screenshotRect({ rect: contRect, filepath: `${await getFileNamePrefix()}${idx}` });

        //reset margin:
        child.style[`display`] = `${prevDisplay}`;
        child.style[`margin-${siblingFacingSide}`] = `${prevMargin}`;
      })
    );
    return count;

    function meanOfAbs(arr: number[]): number {
      const sum = arr.reduce((prev, curr) => {
        return prev + Math.abs(curr);
      }, 0);
      return sum / arr.length;
    }

    function distances(arr: DOMRect[], dir: Direction): number[] {
      return arr.flatMap((curr, idx) => {
        if (idx === 0) {
          return [];
        }

        const prev = arr[idx - 1];
        if (dir === "horizontal") {
          return prev.right - curr.left;
        } else {
          return prev.bottom - curr.top;
        }
      });
    }

    function getSiblingFacingSide(isFirst: boolean, isLast: boolean, direction: Direction): Side {
      if (direction === "horizontal") {
        if (isFirst) {
          return "right";
        }
        if (isLast) {
          return "left";
        } else {
          //@ts-ignore
          return getRandomElement(["left", "right"]) as Side;
        }
      } else {
        if (isFirst) {
          return "bottom";
        }
        if (isLast) {
          return "top";
        } else {
          //@ts-ignore
          return getRandomElement(["top", "bottom"]) as Side;
        }
      }
    }

    function getLayoutDirection(container: HTMLElement): Direction {
      const childRects = Array.from(container.children).map((el) => el.getBoundingClientRect());
      const verDistances = distances(childRects, "vertical");
      const horDistances = distances(childRects, "horizontal");

      return meanOfAbs(verDistances) < meanOfAbs(horDistances) ? "vertical" : "horizontal";
    }
  }, params.containers);
}
