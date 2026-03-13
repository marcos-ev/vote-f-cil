import { expect, test } from "@playwright/test";

test("fluxo básico: criar squad e iniciar/revelar votação", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  await page.goto("/login");

  await page.getByRole("button", { name: "Não tem conta? Cadastre-se" }).click();
  await page.getByPlaceholder("Ex: Marco").fill("Marco QA");
  await page.getByPlaceholder("Ex: marco").fill(`marco${suffix}`);
  await page.getByPlaceholder("Sua senha").fill("1234");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");

  await page.getByPlaceholder("Ex: Squad Backend").fill("Squad Smoke");
  await page.getByRole("button", { name: "Criar", exact: true }).click();

  await expect(page).toHaveURL(/\/sala\//);
  await page.getByPlaceholder("Ex: US-123 - Login com SSO").fill("SMOKE-1");
  await page.getByRole("button", { name: "Iniciar Votação" }).click();

  await expect(page.getByText("Votando em")).toBeVisible();
  await page.getByRole("button", { name: "Revelar Votos" }).click();
  await expect(page.getByRole("button", { name: "Nova Rodada" })).toBeVisible();
});
