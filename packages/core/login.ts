import {
  chromium,
  LaunchOptions,
  BrowserContext,
  Page,
  Browser,
} from "playwright-chromium";
import {
  LOGIN_ID,
  LOGIN_PASSWORD,
  LOGIN_SUBMIT_BUTTON,
  MOBILE_LOGIN_ID,
  MOBILE_LOGIN_PASSWORD,
  MOBILE_LOGIN_SUBMIT_BUTTON,
  MOBILE_URL_TOP,
  URL_TOP,
} from "./selectors";
import { getUserData, LoginInfo, removeUserInfo } from "./userData";
import { navigate } from "./navigate";

export type LoginContext = {
  ctx: BrowserContext;
  page: Page;
};

export type Result<T, E = string> = {
  error?: E;
  data?: T;
};

export type LoginOptions = {
  target?: LoginTarget;
  removeUserInfoOnError?: boolean;
};

export type LoginTarget = "pc" | "mobile";
export const LOGIN_SELECTORS: Record<
  LoginTarget,
  {
    URL: string;
    ID: string;
    PASSWORD: string;
    SUBMIT: string;
  }
> = {
  pc: {
    URL: URL_TOP,
    ID: LOGIN_ID,
    PASSWORD: LOGIN_PASSWORD,
    SUBMIT: LOGIN_SUBMIT_BUTTON,
  },
  mobile: {
    URL: MOBILE_URL_TOP,
    ID: MOBILE_LOGIN_ID,
    PASSWORD: MOBILE_LOGIN_PASSWORD,
    SUBMIT: MOBILE_LOGIN_SUBMIT_BUTTON,
  },
};

export async function login(
  browser: Browser,
  info: LoginInfo,
  loginOptions: LoginOptions = {}
): Promise<Result<LoginContext>> {
  const target = loginOptions.target ?? "pc";
  const loginSelectors = LOGIN_SELECTORS[target];

  const { id, password } = info;
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  try {
    await navigate(page).byGoto(loginSelectors.URL);

    const maintenanceMessage = await page.evaluate(() => {
      const e = document.querySelector("#funcContent > div > p");
      const textContentOf = (e?: Element | null) =>
        e?.textContent?.trim() ?? "";
      return e === null ? e : textContentOf(e);
    });

    if (maintenanceMessage) {
      throw new Error(maintenanceMessage);
    }

    await page.type(loginSelectors.ID, id);
    await page.type(loginSelectors.PASSWORD, password);
    await navigate(page).byClick(loginSelectors.SUBMIT);

    const loginErrorMessage = await page.evaluate(() => {
      const e = document.querySelector(".ui-messages-error-detail");
      const textContentOf = (e?: Element | null) =>
        e?.textContent?.trim() ?? "";
      return e === null ? e : textContentOf(e);
    });

    if (loginErrorMessage) {
      if (loginOptions.removeUserInfoOnError) {
        await removeUserInfo();
      }
      throw new Error(loginErrorMessage);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    await ctx.close();

    return { error };
  }

  return { data: { ctx, page } };
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function exposeGlobalHelper(ctx: BrowserContext) {}

export async function withLogin<T>(
  fn: (ctx: LoginContext) => Promise<T>,
  option?: LaunchOptions,
  loginOptions?: LoginOptions
): Promise<Result<T>> {
  const info = await getUserData();
  const userInfo = info?.user;
  if (!userInfo) {
    return { error: "please provide login info, try `dhu login`" };
  }
  return withBrowser(async (browser) => {
    const { error, data: loginContext } = await login(
      browser,
      userInfo,
      loginOptions
    );
    if (error) {
      throw error;
    }
    if (!loginContext) {
      throw new Error("failed to init loginContext");
    }
    return fn(loginContext);
  }, option);
}

export async function withBrowser<T>(
  fn: (browser: Browser) => Promise<T>,
  option?: LaunchOptions
): Promise<Result<T>> {
  const browser = await chromium.launch(option);
  let result: Result<T> = {};
  try {
    const data = await fn(browser);
    result = { data };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    result = { error };
  }
  await browser.close();
  return result;
}

export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  option?: LaunchOptions
) {
  return withBrowser(async (browser) => {
    try {
      const ctx = await browser.newContext({ acceptDownloads: true });
      const page = await ctx.newPage();
      const data = await fn(page);
      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }, option);
}
