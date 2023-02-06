/* eslint-disable @typescript-eslint/ban-ts-ignore */
import minimist from "minimist";
import puppeteer from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import generateHash from "random-hash";
import randomWords from "random-words";
import { Resolution } from "./types";
import { ensureFolderExists, getFileName, screenshotElements, screenshotRect } from "./utils";
import { attemptCookieConsent } from "./cookies";
import { getContainers } from "./getContainers";
import { Page } from "puppeteer";
import SITES from "./sites";

// ways of sharing:
// - addScriptTag
// - exposeFunction
// - pass as parameter to page evaluate (only elementhandles)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { generateOverlapScreenshots } from "./browser-context/overlap";
import { generateOverflowScreenshots } from "./browser-context/overflow";

const UNTOUCHED = "untouched";
const OVERFLOW = "overflow";
const OVERLAP = "overlap";

const MANIPULATIONS = [UNTOUCHED, OVERFLOW, OVERLAP] as const;

type Manipulation = typeof manipulations[number];

const EXECUTION_ID = `${new Date().getMonth()}-${new Date().getDate()}-${generateHash({ length: 4 })}`;
const VIEWPORTS: Resolution[] = [
  //{ width: 768, height: 2000 },
  //{ width: 375, height: 2000 },
  { width: 1000, height: 2500 }
];

interface Args {
  contindex?: string;
  folder?: string;
  debug?: string;
  site?: string;
  manipulations?: string;
  _?: unknown; //something added by minimist?
}
const { _: _throwaway, ...args }: Args = minimist<Args>(process.argv.slice(2));

const DEFAULT_FOLDER = "layout-breaker-images";
const { manipulations: argsManipulations, folder: BASE_FOLDER = DEFAULT_FOLDER, debug, contindex, site: SITE, ...extraArgs } = args;

const CONT_INDEX = contindex ? parseInt(contindex) : undefined;
const DEBUG_MODE = !!debug;

const manipulations = argsManipulations ? argsManipulations.split(",").map((_) => _.trim()) : MANIPULATIONS;

if (Object.keys(extraArgs).length > 0) {
  console.error(`Unknown command line argument(s): ${JSON.stringify(extraArgs)}.`);
  process.exit();
}

if (argsManipulations && manipulations.some((manipulation) => !MANIPULATIONS.includes(manipulation))) {
  console.error(`Incorrect manipulations argument: ${argsManipulations}.`);
  process.exit();
}

console.log(`Starting scraping DEBUG_MODE ${DEBUG_MODE}, with args: ${JSON.stringify(args)}`);

interface TaskData {
  site: string;
  viewport: Resolution;
  baseFolder: string;
  manipulation: Manipulation;
}

const puppeteerOptions = {
  headless: !DEBUG_MODE,
  devtools: DEBUG_MODE
  // executablePath: "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
};

const clusterConfig = {
  monitor: true,
  puppeteerOptions,
  maxConcurrency: DEBUG_MODE ? 1 : 4,
  timeout: DEBUG_MODE ? 15000000 : 30000,
  concurrency: Cluster.CONCURRENCY_CONTEXT
};

const RUN_PARALLEL = true;

(async (): Promise<void> => {
  let cluster = undefined;

  if (RUN_PARALLEL) {
    cluster = await Cluster.launch(clusterConfig);

    await cluster.task(scrapeSite);

    cluster.on("taskerror", (err, data) => {
      console.error(`------ERROR CRAWLING ${data.manipulation.toUpperCase()} ${data.site}-${data.viewport.width}x${data.viewport.height}`);
      console.log(`\n${err.filename}`);
      console.log(`\n${err.message}`);
      console.log(err.stack);
    });
  }

  const sites = SITE && SITE.length ? [SITE] : SITES;

  sites.forEach((site) => {
    VIEWPORTS.forEach(async (viewport) => {
      for (const manipulation of manipulations) {
        const taskData: TaskData = {
          baseFolder: BASE_FOLDER,
          site,
          viewport,
          manipulation
        };

        if (cluster) {
          cluster.queue(taskData);
        } else {
          const browser = await puppeteer.launch();
          const page = await browser.newPage();
          await scrapeSite({ page, data: taskData }).catch((err) => {
            console.error("Encountered error", JSON.stringify(err));
            console.error("Encountered error", err.stack);
          });
        }
      }
    });
  });

  if (cluster) {
    await cluster.idle();
    await cluster.close();
  }
  console.log("\n-----------------END RUN ", EXECUTION_ID, "-----------------------------------\n");
})();

async function scrapeSite({ page, data }: { page: Page; data: TaskData }): Promise<void> {
  const { site, viewport, manipulation, baseFolder } = data;

  await page.setBypassCSP(true);
  await page
    .goto(site, { waitUntil: "networkidle2", timeout: 0 })
    .catch((error) => console.error(`Error accessing  ${site}: ${JSON.stringify(error)}`));
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });

  await page.addScriptTag({ path: "./build/browser-context/index.js" });

  await attemptCookieConsent(page);

  // print page context logs to terminal(=node context):
  page.on("console", (consoleObj) => {
    console.log(consoleObj.text());
  });

  // DEFINE FOLDERS
  const folderName = `${baseFolder}/${manipulation}`;
  await ensureFolderExists(folderName);

  const entirePagesFolder = `${BASE_FOLDER}/entire-pages`;
  const filename = getFileName({ viewport, url: site, prefix: EXECUTION_ID, postfix: manipulation });
  await ensureFolderExists(entirePagesFolder);

  await page.exposeFunction("screenshotRect", (params) => screenshotRect(page, params));
  await page.exposeFunction("getFileNamePrefix", () => `${folderName}/${filename}`);
  await page.exposeFunction("randomWords", randomWords);

  // GET SCREENSHOT ELEMENTS
  const containers = await getContainers(page, CONT_INDEX);

  const filepath = `${folderName}/${getFileName({ viewport, url: site, postfix: EXECUTION_ID })}`;

  let elementCount = 0;

  if (manipulation === OVERFLOW) {
    elementCount = await generateOverflowScreenshots({ page, containers });
  } else if (manipulation === OVERLAP) {
    elementCount = await generateOverlapScreenshots({ containers, page });
  } else if (manipulation === UNTOUCHED) {
    elementCount = await screenshotElements({ page, elements: containers, filepath });
  } else {
    throw "Unknown manipulation";
  }

  // promise.catch((err) => {
  //   console.log("Error in manipulation", err);
  //   return 0;
  // });

  //await screenshotRects(page, rects, folderName, viewport, site);
  console.log(`Number of ${manipulation.toUpperCase()} rects is ${elementCount} for site ${site} in ${viewport.width}x${viewport.height}.`);

  await page.screenshot({
    path: `${entirePagesFolder}/${filename}.png`
  });

  if (manipulation === UNTOUCHED) {
    // add red border to containers  for debugging:
    await page.evaluate(async function (containers) {
      await Promise.all(containers.map((el) => ((el as HTMLElement).style["border"] = "1px solid red")));
    }, containers);
    await page.screenshot({
      path: `${entirePagesFolder}/${getFileName({ viewport, url: site, prefix: EXECUTION_ID, postfix: "containers" })}.png`
    });
  }
}
