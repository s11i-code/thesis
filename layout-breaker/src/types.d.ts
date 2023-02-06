import { JSHandle } from "puppeteer";

export type Resolution = {
  width: number;
  height: number;
};

export type ContainerList = JSHandle<HTMLElement[]>;

window.createGreeting = function (s) {
  return "Hello, " + s;
};
