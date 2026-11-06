/** Nom du site : défini UNE seule fois, par la variable d’environnement SITE_NAME (valeur par défaut : « Rideau »). */
export const siteName = () => process.env.SITE_NAME?.trim() || "Rideau";
