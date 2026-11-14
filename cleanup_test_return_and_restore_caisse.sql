-- =============================================================================
-- cleanup_test_return_and_restore_caisse.sql
-- Phase 1.1: Supprimer le faux retour de test et restaurer la caisse du jour
-- =============================================================================

-- 1. Supprimer les lignes d'articles associées au retour de test
DELETE FROM public.return_items 
WHERE return_id = '1a0682ff-1177-4497-b430-8c27ca2cf505';

-- 2. Supprimer le retour de test qui déduisait 88.000 DT de la caisse
DELETE FROM public.returns 
WHERE id = '1a0682ff-1177-4497-b430-8c27ca2cf505';

-- 3. Notifier PostgREST pour actualiser le cache
NOTIFY pgrst, 'reload schema';

