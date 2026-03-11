import { expect, test } from "@playwright/test";

test("fluxo básico: criar squad e iniciar/revelar votação", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("Ex: Marco").fill("Marco QA");
  await page.getByPlaceholder("Ex: Squad Backend").fill("Squad Smoke");
  await page.getByRole("button", { name: "Criar", exact: true }).click();

  await expect(page).toHaveURL(/\/sala\//);
  await page.getByPlaceholder("Ex: US-123 - Login com SSO").fill("SMOKE-1");
  await page.getByRole("button", { name: "Iniciar Votação" }).click();

  await expect(page.getByText("Votando em")).toBeVisible();
  await page.getByRole("button", { name: "Revelar Votos" }).click();
  await expect(page.getByRole("button", { name: "Nova Rodada" })).toBeVisible();
});
