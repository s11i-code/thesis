/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { Page } from "puppeteer";
import { ContainerList } from "./types";

export async function getContainers(page: Page, contIndex: number): Promise<ContainerList> {
  return page.evaluateHandle(async (contIndex: number) => {
    const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
    const isInViewport = (bounding: DOMRect): boolean =>
      bounding.top >= 0 && bounding.left >= 0 && bounding.right <= viewport.width && bounding.bottom <= viewport.height;

    const isOptimalSize = (bounding: DOMRect): boolean => {
      const { width, height } = bounding;
      const area = width * height;
      const viewportArea = viewport.width * viewport.height;
      return width > viewport.width * 0.2 && height > 50 && area < viewportArea * 0.5;
    };

    const dupesAllowed = 1;

    const containers = [];
    const occurrences = {};

    const containerSelectors = "div, section, article, ul, aside, header, footer, button";

    Array.from(document.querySelectorAll(containerSelectors)).forEach((cont: HTMLElement) => {
      const hasText = cont.innerText.length > 0;
      const rect = cont.getBoundingClientRect();
      const dupeCount = occurrences[JSON.stringify(rect)] || 0;
      //@ts-ignore Cannot find name 'isVisibleInDOM'.ts(2304)
      if (hasText && dupeCount < dupesAllowed && isInViewport(rect) && isOptimalSize(rect) && isVisibleInDOM(cont)) {
        containers.push(cont);
        occurrences[JSON.stringify(rect)] = dupeCount + 1;
      }
    });
    if (contIndex) {
      return containers[contIndex] ? [containers[contIndex]] : [];
    }

    return containers;
  }, contIndex);
}
