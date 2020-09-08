import { Page } from "puppeteer";
import { ContainerList } from "./types";

export async function getContainers(page: Page, contIndex: number): Promise<ContainerList> {
  return page.evaluateHandle(async (contIndex: number) => {
    const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };

    function elementIsVisible(startElement: HTMLElement): boolean {
      // todo: check these techniques: https://webaim.org/techniques/css/invisiblecontent
      let element = startElement;
      while (element && !element.tagName.match(/body/i)) {
        const takesSpace = [element.offsetWidth, element.offsetHeight].every((offset) => offset > 0);
        if (!takesSpace) {
          return false;
        }
        const { display, visibility, opacity, clip } = window.getComputedStyle(element);
        const visible =
          takesSpace && visibility !== "hidden" && display !== "none" && opacity !== "0" && clip !== "rect(1px, 1px, 1px, 1px)";
        if (!visible) {
          return false;
        }
        element = element.parentElement;
      }
      return true;
    }

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
      if (hasText && dupeCount < dupesAllowed && isInViewport(rect) && isOptimalSize(rect) && elementIsVisible(cont)) {
        containers.push(cont);
        occurrences[JSON.stringify(rect)] = dupeCount + 1;
      }
    });
    if (contIndex) {
      return [containers[contIndex]];
    }

    return containers;
  }, contIndex);
}
