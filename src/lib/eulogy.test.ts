import { describe, expect, it } from "vitest";

import { buildEulogyDraft } from "./eulogy";

describe("buildEulogyDraft", () => {
  it("builds from records only, with a placeholder for the missing life story", () => {
    const text = buildEulogyDraft({
      name: "Sarah Khamala",
      gender: "FEMALE",
      bornDate: "12 Mar 1948",
      bornPlace: "Kakamega",
      diedDate: "3 Jan 2020",
      ageYears: 71,
      clan: "Mukhwana",
      subClan: "Abamuli",
      community: "Bukusu",
      parents: ["John Khamala", "Mary Nasimiyu"],
      spouses: ["Peter Wafula"],
      children: ["Ann", "Ben"],
      restingPlace: "the family home",
    });
    expect(text).toContain("Sarah Khamala was born on 12 Mar 1948 in Kakamega");
    expect(text).toContain("born to John Khamala and Mary Nasimiyu");
    expect(text).toContain("Mukhwana (Abamuli) clan");
    expect(text).toContain("Sarah was married to Peter Wafula");
    expect(text).toContain("blessed with 2 children: Ann and Ben");
    expect(text).toContain("[Add here:");
    expect(text).toContain("She was 71 years old");
  });

  it("weaves in the biography-wizard notes and drops the placeholder", () => {
    const text = buildEulogyDraft({
      name: "Peter Wafula",
      gender: "MALE",
      diedDate: "2021",
      notes: {
        education: "Friends School Kamusinga",
        career: "he taught mathematics for 30 years",
        faith: "he served as an elder at his local church",
        character: "a patient and generous man",
        lastWords: "look after each other",
        favouriteScripture: "Psalm 23",
      },
    });
    expect(text).not.toContain("[Add here:");
    expect(text).toContain("educated at Friends School Kamusinga");
    expect(text).toContain("he taught mathematics for 30 years");
    expect(text).toContain("person of faith");
    expect(text).toContain("remember him as a patient and generous man");
    expect(text).toContain("Peter said: “look after each other”");
    expect(text).toContain("favourite scripture was Psalm 23");
  });

  it("uses they/them with matching verb agreement when gender is unknown", () => {
    const text = buildEulogyDraft({
      name: "Alex Doe",
      diedDate: "2020",
      parents: ["Sam Doe"],
      restingPlace: "the town cemetery",
    });
    expect(text).toContain("They are survived and remembered");
    expect(text).toContain("They are laid to rest");
    expect(text).toContain("They were born to Sam Doe");
  });
});
