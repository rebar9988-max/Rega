import { testDatabaseClient } from "./database-client";
import { encode, decode } from "fast-png";
import bcrypt from "bcryptjs";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";
import { reindexBusinessTree } from "../../src/lib/search-index";

const db = testDatabaseClient();
const stamp = Date.now().toString(36);
const uploadedBusinessIds: string[] = [];
async function login(page: Page, who = ADMIN) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr(?:\/businesses)?$/);
}
test.afterAll(async () => {
  try {
    // The local fake object store lives for one test run. Retain the rows, but stop serving image fixtures afterwards.
    for (const id of uploadedBusinessIds) {
      await db.business.update({where:{id},data:{status:"archived",verified:false,archivedAt:new Date()}});
      await reindexBusinessTree(db,id);
    }
  } finally { await db.$disconnect(); }
});
test("staff verification publishes atomically; canonical categories, search, country, counts and suspension agree", async ({
  page,
  browser,
  request,
}) => {
  const city = await db.city.findFirstOrThrow({
    where: { nameEn: "Berlin", country: { code: "DE" } },
  });
  const cats = await db.category.findMany({
    where: { sectionKey: "businesses" },
  });
  const cat = (key: string) => cats.find((c) => c.key === key)!;
  const ids: string[] = [];
  for (const [label, primary, wrong] of [
    ["Barber", "beauty-barber", "travel-tickets"],
    ["Butcher", "groceries-markets", "transport-moving"],
  ]) {
    const b = await db.business.create({
      data: {
        name: `E2E ${label} ${stamp}`,
        slug: `e2e-${label.toLowerCase()}-${stamp}`,
        categoryId: cat(primary).id,
        status: "pending",
        verified: false,
        locations: {
          create: {
            addressLine1: "Street 12",
            countryCode: "DE",
            cityId: city.id,
            isPrimary: true,
            latitude: 52.5,
            longitude: 13.4,
            coordsVerifiedAt: new Date(),
          },
        },
        services: {
          create: {
            name: `E2E unrelated service ${stamp}`,
            slug: "other",
            categoryId: cat(wrong).id,
            status: "published",
          },
        },
      },
    });
    await reindexBusinessTree(db, b.id);
    ids.push(b.id);
    expect(
      (
        await (
          await request.get(
            `/api/v1/businesses?q=${encodeURIComponent(b.name)}`,
          )
        ).json()
      ).meta.total,
    ).toBe(0);
  }
  await login(page);
  const first = await page.request.patch(`/api/v1/businesses/${ids[0]}`, {
    data: { verified: true },
  });
  expect(first.status()).toBe(200);
  expect((await first.json()).data).toMatchObject({
    verified: true,
    status: "published",
    categoryId: cat("beauty-barber").id,
  });
  // Verify through the actual admin action for the second record.
  await page.goto(
    `/dr/businesses?status=pending&q=${encodeURIComponent(`E2E Butcher ${stamp}`)}`,
  );
  await page.getByRole("button", { name: "Prüfen & veröffentlichen" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(0);
  const anon = await browser.newContext();
  const publicPage = await anon.newPage();
  for (const [index, primary, wrong] of [
    [0, "beauty-barber", "travel-tickets"],
    [1, "groceries-markets", "transport-moving"],
  ] as const) {
    const b = await db.business.findUniqueOrThrow({
      where: { id: ids[index] },
    });
    const json = await (
      await request.get(
        `/api/v1/businesses?q=${encodeURIComponent(b.name)}&categoryId=${cat(primary).id}&cityId=${city.id}&country=DE`,
      )
    ).json();
    expect(json.meta.total).toBe(1);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].createdById).toBeUndefined();
    expect(json.data[0].searchText).toBeUndefined();
    expect(
      (
        await (
          await request.get(
            `/api/v1/businesses?q=${encodeURIComponent(b.name)}&categoryId=${cat(wrong).id}`,
          )
        ).json()
      ).meta.total,
    ).toBe(0);
    expect(
      (
        await (
          await request.get(
            `/api/v1/businesses?q=${encodeURIComponent(b.name)}&country=IQ`,
          )
        ).json()
      ).meta.total,
    ).toBe(0);
    await publicPage.goto(
      `/de/businesses/${primary}?q=${encodeURIComponent(b.name)}&country=DE&city=${city.id}`,
    );
    await expect(publicPage.getByRole("main")).toContainText(b.name);
    await publicPage.goto(
      `/de/search?q=${encodeURIComponent(b.name)}&type=businesses`,
    );
    await expect(publicPage.getByRole("main")).toContainText(b.name);
  }
  expect(
    (
      await page.request.patch(`/api/v1/businesses/${ids[0]}`, {
        data: { categoryId: "not-real" },
      })
    ).status(),
  ).toBe(422);
  const suspended = await page.request.post("/api/v1/businesses/bulk", {
    data: { ids: [ids[0]], action: "archive" },
  });
  expect(suspended.ok()).toBe(true);
  expect(
    (
      await (
        await request.get(
          `/api/v1/businesses?q=${encodeURIComponent(`E2E Barber ${stamp}`)}`,
        )
      ).json()
    ).meta.total,
  ).toBe(0);
  expect((await request.get(`/api/v1/businesses/${ids[0]}`)).status()).toBe(
    404,
  );
  expect(
    (
      await page.request.patch(`/api/v1/businesses/${ids[0]}`, {
        data: { verified: true },
      })
    ).status(),
  ).toBe(422);
  await anon.close();
});

test("non-owner and anonymous callers cannot verify or change categories", async ({
  page,
  request,
}) => {
  const b = await db.business.findUniqueOrThrow({
    where: { slug: "zagros-restaurant" },
  });
  expect(
    (
      await request.patch(`/api/v1/businesses/${b.id}`, {
        data: { verified: true },
      })
    ).status(),
  ).toBe(401);
  await login(page, EMPLOYEE);
  for (const data of [
    { verified: true },
    { categoryId: "seed_category_legal" },
  ])
    expect(
      (
        await page.request.patch(`/api/v1/businesses/${b.id}`, { data })
      ).status(),
    ).toBe(403);
});


test("directory and category pages share responsive cards and preserve Kurdish RTL and supported languages", async ({
  page,
}) => {
  for (const locale of ["ckb", "en", "ar", "de", "fa", "kmr", "tr"]) {
    await page.goto(`/${locale}/businesses/legal`);
    await expect(page.getByTestId("category-navigation")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      ["ckb", "ar", "fa"].includes(locale) ? "rtl" : "ltr",
    );
    await expect(
      page.locator('main a[href$="/business/kurdistan-rechtsberatung"]'),
    ).toBeVisible();
    const overflow = await page
      .locator("main")
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  }
  // A shared link to an active country with no public listings retains its selection and honest empty state.
  await page.goto("/en/businesses?country=IQ&city=");
  await expect(page.locator("#f-country")).toHaveValue("IQ");
  const geo = await (await page.request.get("/api/v1/geo?country=IQ")).json();
  expect(geo.data.countries.some((c:{code:string}) => c.code === "IQ")).toBe(true);
  expect(geo.data.cities.every((c:{countryCode:string}) => c.countryCode === "IQ")).toBe(true);

});

test.describe("Image editor with intercepted upload failures", () => {
// WebKit cannot route network interception through a controlled service worker.
// Only this mocked-network case blocks SW; real upload/publication cases retain it.
test.use({ serviceWorkers: "block" });
test("image editor keeps crop on upload failure and saves exactly the preview geometry", async ({
  page,
  browserName,
}) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input).includes("/api/v1/media/business-image") && init?.body instanceof Blob)
        (window as unknown as {cropBytes:number[]}).cropBytes = Array.from(new Uint8Array(await init.body.arrayBuffer()));
      return original(input, init);
    };
  });
  await login(page);
  await page.goto("/dr/businesses/new");
  const pixels = new Uint8Array(200 * 100 * 4);
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < 200; x++) {
      const i = (y * 200 + x) * 4;
      pixels[i] = x < 100 ? 255 : 0;
      pixels[i + 2] = x >= 100 ? 255 : 0;
      pixels[i + 3] = 255;
    }
  const file = {
    name: "wide.png",
    mimeType: "image/png",
    buffer: Buffer.from(encode({ width: 200, height: 100, data: pixels })),
  };
  let attempts = 0;
  await page.route("**/api/v1/media/business-image**", async (route) => {
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { publicUrl: "https://media.example.org/confirmed.png" },
      }),
    });
  });
  await page.getByTestId("upload-logoUrl").setInputFiles(file);
  const editor = page.getByTestId("image-editor");
  await expect(editor).toBeVisible();
  await editor.getByLabel("Zoom", { exact: true }).fill("2");
  const frame = editor.getByTestId("crop-preview");
  await frame.scrollIntoViewIfNeeded();
  let box = (await frame.boundingBox())!;
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await editor.getByRole("button", { name: "Zurücksetzen" }).click();
    await frame.scrollIntoViewIfNeeded();
    box = (await frame.boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 30, y: cy, id: 1 },
        { x: cx + 30, y: cy, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: cx - 60, y: cy, id: 1 },
        { x: cx + 60, y: cy, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(
      Number(await editor.getByLabel("Zoom", { exact: true }).inputValue()),
    ).toBeGreaterThan(1.5);
    await cdp.detach();
    await editor.getByRole("button", { name: "Zurücksetzen" }).click();
    await editor.getByLabel("Zoom", { exact: true }).fill("2");
  }
  await frame.scrollIntoViewIfNeeded();
  box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + box.width / 4,
    box.y + box.height / 2,
  );
  await page.mouse.up();
  await editor.getByRole("button", { name: "Bild bestätigen" }).click();
  await expect(editor).toBeVisible();
  await expect(page.getByTestId("upload-logoUrl-state")).toBeVisible();
  await editor.getByRole("button", { name: "Bild bestätigen" }).click();
  await expect(editor).toHaveCount(0);
  expect(attempts).toBe(2);
  const saved = await page.evaluate(() => (window as unknown as {cropBytes:number[]}).cropBytes);
  const decoded = decode(Uint8Array.from(saved));
  expect(decoded.width).toBe(512);
  expect(decoded.height).toBe(512);
  // A rightward drag of the zoomed wide image shows more of its red left half, without stretching.
  const channels = decoded.channels;
  const center = (256 * 512 + 256) * channels;
  expect(decoded.data[center]).toBeGreaterThan(240);
  expect(decoded.data[center + 2]).toBeLessThan(15);
  await expect(page.locator("input[name=logoUrl]")).toHaveValue(
    "https://media.example.org/confirmed.png",
  );
});

});

test("owner completes registration and real image upload; approval publishes and stale autosave cannot overwrite it", async ({
  page, browser,
}) => {
  test.setTimeout(60_000);
  const owner = {
    email: `business-owner-${stamp}-${test.info().project.name}@example.org`,
    password: "e2e-business-owner-password",
  };
  await db.user.upsert({
    where: { email: owner.email },
    update: {},
    create: {
      email: owner.email,
      passwordHash: await bcrypt.hash(owner.password, 10),
      role: "BUSINESS_OWNER",
      emailVerified: new Date(),
      locale: "de",
    },
  });
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
    }),
  );
  await login(page, owner);
  await page.goto("/dr/businesses/new");
  const name = `E2E Simple registration ${stamp} ${test.info().project.name}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Kategorien suchen", { exact: true }).fill("Recht");
  await page
    .getByRole("combobox", { name: "Kategorie", exact: true })
    .selectOption({ label: "Recht" });
  await page.getByLabel("Straße und Hausnummer").fill("Street 12");
  await page.getByLabel("Stadt", { exact: true }).fill("Berlin");
  await page.getByTestId("lat").fill("52.5");
  await page.getByTestId("lng").fill("13.4");
  await page.getByTestId("confirm-location").check();
  await expect(page.getByTestId("draft-saved")).toBeVisible({ timeout: 10000 });
  const stale = await page.context().newPage();
  await stale.goto(`/dr/businesses/${await page.locator("input[name=id]").inputValue()}`);
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("wizard-step-2")).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByTestId("wizard-back").click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
  await page.getByTestId("wizard-next").click();
  const image = Buffer.from(encode({ width: 2, height: 1, data: new Uint8Array([255,0,0,255,0,0,255,255]) }));
  await page.getByTestId("upload-logoUrl").setInputFiles({name:"owner.png",mimeType:"image/png",buffer:image});
  await page.getByTestId("image-editor").getByRole("button", {name:"Bild bestätigen"}).click();
  await expect(page.getByTestId("image-editor")).toHaveCount(0);
  let logoUrl = await page.locator("input[name=logoUrl]").inputValue();
  expect(logoUrl).toContain("/business-images/");
  const draftId = await page.locator("input[name=id]").inputValue();
  await expect.poll(async () => (await db.business.findUniqueOrThrow({where:{id:draftId}})).logoUrl).toBe(logoUrl);
  // Removing asks for confirmation first.
  page.once("dialog", (dialog) => { expect(dialog.message()).toBe("Dieses Bild entfernen?"); void dialog.accept(); });
  await page.getByTestId("business-image-logoUrl").getByRole("button", {name:"Bild entfernen",exact:true}).click();
  await expect.poll(async () => (await db.business.findUniqueOrThrow({where:{id:draftId}})).logoUrl).toBeNull();
  await page.getByTestId("upload-logoUrl").setInputFiles({name:"replaced.png",mimeType:"image/png",buffer:image});
  await page.getByTestId("image-editor").getByRole("button", {name:"Bild bestätigen"}).click();
  await expect(page.getByTestId("image-editor")).toHaveCount(0);
  logoUrl = await page.locator("input[name=logoUrl]").inputValue();
  await page.getByTestId("upload-photos").setInputFiles({name:"business.png",mimeType:"image/png",buffer:image});
  await page.getByTestId("image-editor").getByRole("button", {name:"Bild bestätigen"}).click();
  await expect(page.getByTestId("image-editor")).toHaveCount(0);
  const photo = await page.locator("input[name=photoUrls]").inputValue();
  // The stored URL announces its smaller copies in its query (features/business-images/variants.ts); the Media row holds the plain URL.
  expect((await db.media.findFirstOrThrow({where:{url:photo.split("?")[0]}})).mimeType).toBe("image/jpeg");
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("wizard-review")).toContainText(name);
  await page.getByTestId("submit-review").click();
  await expect(page.getByTestId("business-status")).toHaveText("Ausstehend");
  const rows = await db.business.findMany({ where: { name } });
  expect(rows).toHaveLength(1);
  uploadedBusinessIds.push(rows[0].id);
  expect(rows[0].verified).toBe(false);
  expect(
    (
      await page.request.patch(`/api/v1/businesses/${rows[0].id}`, {
        data: { categoryId: (await db.category.findFirstOrThrow({ where: {key: "food"} })).id },
      })
    ).status(),
  ).toBe(403);
  expect(rows[0].logoUrl).toBe(logoUrl);
  expect(rows[0].photos).toEqual([photo]);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin);
  expect((await admin.request.patch(`/api/v1/businesses/${rows[0].id}`, {data:{verified:true}})).status()).toBe(200);
  // This old tab still believes the record is a draft. Autosave must not overwrite the staff decision.
  await stale.getByLabel("Name", {exact:true}).fill(`${name} stale`);
  await expect(stale.getByTestId("form-error")).toContainText("bereits eingereicht");
  expect(await db.business.findUnique({where:{id:rows[0].id},select:{name:true,status:true,verified:true,logoUrl:true}})).toEqual({name,status:"published",verified:true,logoUrl});
  await page.goto(`/de/businesses/legal?q=${encodeURIComponent(name)}&city=`);
  await expect(page.getByRole("main").getByRole("link", {name,exact:true})).toBeVisible();
  // The logo is the 512 px original as src; its smaller copy is offered in srcset for the small card box.
  const logo = page.locator(`main article img[src="${logoUrl.split("?")[0]}"]`);
  await expect(logo).toHaveCSS("object-fit","contain");
  await expect(logo).toHaveAttribute("srcset", new RegExp(`-w160\\.png 160w, .*\\.png 512w$`));
  await adminCtx.close(); await stale.close();

});

test("server validates image bytes and upload permissions before storage", async ({
  page,
  request,
}) => {
  expect(
    (
      await request.post("/api/v1/media/business-image", {
        headers: { "content-type": "image/png" },
        data: Buffer.from("<svg/>"),
      })
    ).status(),
  ).toBe(401);
  const owner = {email:`image-owner-${stamp}-${test.info().project.name}@example.org`,password:"e2e-image-password"};
  const actor = await db.user.create({data:{email:owner.email,passwordHash:await bcrypt.hash(owner.password,10),role:"BUSINESS_OWNER",emailVerified:new Date(),locale:"de"}});
  await login(page, owner);
  for (const mime of ["image/png", "image/jpeg"])
    expect(
      (
        await page.request.post("/api/v1/media/business-image", {
          headers: { "content-type": mime },
          data: Buffer.from('<svg onload="alert(1)"/>'),
        })
      ).status(),
    ).toBe(422);
  expect(
    (
      await page.request.post("/api/v1/media/business-image", {
        headers: { "content-type": "image/svg+xml" },
        data: Buffer.from("<svg/>"),
      })
    ).status(),
  ).toBe(422);
  const pixels = new Uint8Array([255,0,0,255]);
  const png = Buffer.from(encode({width:1,height:1,data:pixels,text:{Comment:"secret-metadata"}}));
  const upload = await page.request.post("/api/v1/media/business-image", {headers:{"content-type":"image/png"}, data:png});
  expect(upload.status()).toBe(201);
  const asset = (await upload.json()).data;
  const media = await db.media.findUniqueOrThrow({where:{id:asset.assetId}});
  expect(media).toMatchObject({uploadedById:actor.id,width:1,height:1,mimeType:"image/png"});
  expect(media.storageKey).toMatch(/^business-images\/[0-9a-f-]+\.png$/);
  expect(media.url).not.toContain(actor.id);
  const category = await db.category.findFirstOrThrow({where:{key:"legal"}});
  const create = await page.request.post("/api/v1/businesses", {data:{name:`E2E Asset ${stamp} ${test.info().project.name}`,categoryId:category.id,logoUrl:asset.publicUrl}});
  expect(create.status()).toBe(201);
  const id = (await create.json()).data.id;
  const raw = await db.media.create({data:{storageKey:`library/${actor.id}/raw.png`,url:`https://media.example.org/raw-${actor.id}.png`,mimeType:"image/png",kind:"image",sizeBytes:100,uploadedById:actor.id}});
  for (const url of [raw.url,"https://external.example.org/arbitrary.png"]) {
    expect((await page.request.patch(`/api/v1/businesses/${id}`,{data:{logoUrl:url}})).status()).toBe(422);
    expect((await page.request.post("/api/v1/businesses",{data:{name:"E2E Unsafe media",categoryId:category.id,logoUrl:url}})).status()).toBe(422);
  }
  const foreign = await db.user.findUniqueOrThrow({where:{email:ADMIN.email}});
  const foreignAsset = await db.media.create({data:{storageKey:`business-images/${foreign.id}/foreign-${actor.id}.png`,url:`https://media.example.org/foreign-${actor.id}.png`,mimeType:"image/png",kind:"image",sizeBytes:100,uploadedById:foreign.id}});
  expect((await page.request.patch(`/api/v1/businesses/${id}`,{data:{logoUrl:foreignAsset.url}})).status()).toBe(422);
  expect((await page.request.post(`/api/v1/media/business-image?businessId=${(await db.business.findUniqueOrThrow({where:{slug:"zagros-restaurant"}})).id}`,{headers:{"content-type":"image/png"},data:png})).status()).toBe(403);
  expect((await page.request.post("/api/v1/media/business-image",{headers:{"content-type":"image/jpeg"},data:png})).status()).toBe(422);
  expect((await page.request.post("/api/v1/media/business-image",{headers:{"content-type":"image/png"},data:Buffer.alloc(6*1024*1024+1)})).status()).toBe(413);

});


test("image formats normalize to a stable preview; unsupported phone files have a clear replacement fallback", async ({page}) => {
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob | MediaSource) => { (window as unknown as { lastImageType: string }).lastImageType = blob instanceof Blob ? blob.type : ""; return create(blob); };
  });
  await login(page);
  await page.goto("/dr/businesses/new");
  const field = page.getByTestId("upload-logoUrl");
  for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
    const bytes = await page.evaluate((mime) => {
      const c = document.createElement("canvas"); c.width=9;c.height=40;
      const ctx=c.getContext("2d")!;ctx.fillStyle="red";ctx.fillRect(0,0,9,40);
      return c.toDataURL(mime).split(",")[1];
    },mime);
    await field.setInputFiles({name:`tall.${mime.split("/")[1]}`,mimeType:mime,buffer:Buffer.from(bytes,"base64")});
    await expect(page.getByTestId("crop-preview")).toBeVisible();
    await expect(page.getByTestId("crop-preview").locator("img")).toHaveJSProperty("naturalHeight",40);
    await page.getByTestId("image-editor").getByRole("button",{name:"Abbrechen",exact:true}).click();
  }
  await field.setInputFiles({name:"animation.gif",mimeType:"image/gif",buffer:Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7","base64")});
  await expect(page.getByTestId("image-editor")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { lastImageType: string }).lastImageType)).toBe("image/png");
  await page.getByTestId("image-editor").getByRole("button",{name:"Abbrechen",exact:true}).click();
  await field.setInputFiles({name:"unsupported.heic",mimeType:"image/heic",buffer:Buffer.from("unsupported-source")});
  await expect(page.getByTestId("upload-logoUrl-state")).toContainText("JPG");
  await expect(page.getByTestId("image-editor")).toHaveCount(0);
  await field.setInputFiles({name:"unsafe.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")});
  await expect(page.getByTestId("upload-logoUrl-state")).toContainText("JPG");
});


test("city listing totals count distinct businesses across multiple branches and refresh after suspension", async ({page,request}) => {
  const city = await db.city.findFirstOrThrow({where:{nameEn:"Berlin",country:{code:"DE"}}});
  const category = await db.category.findFirstOrThrow({where:{key:"legal"}});
  const name = `E2E Branch counts ${stamp} ${test.info().project.name}`;
  const b = await db.business.create({data:{name,slug:`e2e-branches-${stamp}-${test.info().project.name}`,status:"published",verified:true,categoryId:category.id,
    locations:{create:[true,false].map(isPrimary=>({isPrimary,status:"active",cityId:city.id,countryCode:"DE",addressLine1:"Street 12",latitude:52.5,longitude:13.4,coordsVerifiedAt:new Date()}))}}});
  await reindexBusinessTree(db,b.id);
  const total = async () => (await (await request.get(`/api/v1/geo?city=${city.id}`)).json()).data.city.count;
  const before = await total();
  const real = await db.business.count({where:{status:"published",verified:true,archivedAt:null,deletedAt:null,category:{isActive:true,deletedAt:null,sectionKey:"businesses"},locations:{some:{cityId:city.id,status:"active",deletedAt:null}}}});
  expect(before).toBe(real);
  await page.goto(`/de/businesses/legal?q=${encodeURIComponent(name)}&city=`);
  const option = page.locator(`#f-city option[value="${city.id}"]`);
  await expect(option).toContainText("(1)");
  await login(page);
  expect((await page.request.patch(`/api/v1/businesses/${b.id}`,{data:{status:"archived"}})).status()).toBe(200);
  expect(await total()).toBe(before-1);
  expect((await request.get(`/api/v1/geo?city=${city.id}`)).headers()["cache-control"]).toBe("no-store");
});
