-- 011: Normalize prospect sources
-- Maps messy free-text source values to standardized slugs

UPDATE prospects SET source = CASE
  WHEN LOWER(source) IN ('internet', 'site web') THEN 'site_web'
  WHEN LOWER(source) IN ('bouche à oreille', 'bouche a oreille', 'parrainage', 'notoriete', 'notorieté') THEN 'bouche_a_oreille'
  WHEN LOWER(source) IN ('annuaire') THEN 'annuaire'
  WHEN LOWER(source) IN ('signalitique', 'signalétique', 'véhicules société', 'vehicules societe') THEN 'signaletique'
  WHEN LOWER(source) IN ('publibostage', 'publipostage', 'boitage', 'flyer', 'sac a baguette') THEN 'publipostage'
  WHEN LOWER(source) IN ('déjà client', 'deja client') THEN 'deja_client'
  WHEN LOWER(source) IN ('telephone', 'téléphone') THEN 'telephone'
  WHEN source = 'recommandation' THEN 'recommandation'
  WHEN LOWER(source) IN ('client serrault', 'crosnier', 'serrault', 'demonfaucon paysage', 'dreamflore') THEN 'recommandation'
  WHEN LOWER(source) IN ('ne sait plus', 'non précisé', 'non precise') THEN 'autre'
  WHEN source IS NOT NULL AND source NOT IN (
    'site_web', 'bouche_a_oreille', 'annuaire', 'signaletique',
    'publipostage', 'deja_client', 'telephone', 'salon',
    'reseaux_sociaux', 'appel_offres', 'recommandation', 'autre'
  ) THEN 'autre'
  ELSE NULL
END
WHERE source IS NOT NULL;
