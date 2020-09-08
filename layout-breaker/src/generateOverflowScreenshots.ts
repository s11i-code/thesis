/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { Page } from "puppeteer";
import { getRandomInt as getRandomIntAlias, screenshotRect as screenshotRectAlias } from "./utils";
import randomWordAlias from "random-words";
import { ContainerList } from "./types";
// must wrap these because ts-node doesn't understand that inside puppeteer evaluate, the context is different
// and you a reference error happens (i think)
async function getRandomInt(min: number, max: number): Promise<number> {
  return getRandomIntAlias(min, max);
}

async function randomWords(params): Promise<string> {
  return randomWordAlias(params);
}

interface Params {
  page: Page;
  containers: ContainerList;
  filepath: string;
}

export async function generateOverflowScreenshots({ page, containers, filepath }: Params): Promise<number> {
  async function screenshotRect(params): Promise<string> {
    return screenshotRectAlias({ page, ...params });
  }

  await page.exposeFunction("getRandomInt", getRandomInt);
  await page.exposeFunction("randomWords", randomWords);
  await page.exposeFunction("screenshotRect", screenshotRect);

  return page.evaluate(
    async (containers, filepath) => {
      let count = 0;
      await Promise.all(
        containers.map(async (elem: HTMLElement, idx: number) => {
          const randDescendent = await getRandomDescendent(elem);
          if (randDescendent.innerText && elem.childElementCount > 2 && randDescendent.tagName === "button") {
            const rect = elem.getBoundingClientRect().toJSON();
            await generateOverflow(randDescendent, `${filepath}-${idx}`, rect);
            count++;
          }

          return Promise.resolve();
        })
      );
      return count;

      async function generateOverflow(child: HTMLElement, filepath: string, containerRect: DOMRect): Promise<void> {
        const childRect = child.getBoundingClientRect();

        preventFromExpanding(child, childRect);
        // increase text to induce overflow
        const oldText = child.innerText;
        child.innerText = await generateText(oldText, child, childRect);
        if (Math.random() > 0.5) {
          child.style["overflow"] = "hidden";
          child.style["text-overflow"] = "clip";
        } else {
          child.style["overflow"] = "revert";
          child.style["text-overflow"] = "visible";
        }
        await screenshotRect({ rect: containerRect, filepath: `${filepath}` });
        child.innerText = oldText; // reset text
      }

      async function getRandomDescendent(element: HTMLElement): Promise<HTMLElement> {
        // get a random descendent that has no children
        let randDescendent = element;
        while (randDescendent.childElementCount > 0) {
          const childIdx = await getRandomInt(0, randDescendent.childElementCount - 1);
          randDescendent = randDescendent.children[childIdx] as HTMLElement;
        }
        return randDescendent;
      }

      function computeSpace(style: CSSStyleDeclaration, rect: DOMRect, dir: "vertical" | "horizontal"): number {
        // The element's size is equal to its width/height + padding + border-width
        // in the case that the standard box model is being used,
        // or width/height only if box-sizing: border-box has been set on it.

        const { boxSizing, paddingTop, paddingBottom, paddingLeft, paddingRight } = style;

        if (boxSizing === "border-box") {
          return dir === "horizontal" ? rect.width : rect.height;
        } else {
          const verticalPadding = parseInt(paddingTop) + parseInt(paddingBottom);
          const horizontalPadding = parseInt(paddingLeft) + parseInt(paddingRight);
          return dir === "horizontal" ? rect.width + horizontalPadding : rect.height + verticalPadding;
        }
      }

      function preventFromExpanding(element: HTMLElement, rect: DOMRect): void {
        element.style["display"] = "block";
        element.style["max-width"] = `${rect.width}px`;
        element.style["width"] = `${rect.width}px`;
        element.style["max-height"] = `${rect.height}px`;
        element.style["height"] = `${rect.height}px`;
      }

      async function generateText(originalText: string, element: HTMLElement, rect: DOMRect): Promise<string> {
        const style = window.getComputedStyle(element);
        const { fontSize } = style;
        const fontSizePx = parseInt(fontSize);
        const horizontalSpace = computeSpace(style, rect, "horizontal");
        const leftoverSpaceFactor = Math.ceil((horizontalSpace * originalText.length) / fontSizePx / 100);
        const min = Math.min(5, leftoverSpaceFactor);
        const max = min * 2.5;
        const text = originalText + (await randomWords({ min, max, join: " " }));
        return text;
      }
    },
    containers,
    filepath
  );
}
