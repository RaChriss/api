/**
 * Script de synchronisation des données PostgreSQL vers Firebase
 * Initialise les collections Firebase à partir des données existantes
 */

import * as admin from 'firebase-admin';
import pool from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function initializeFirebase() {
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }

    return admin.firestore();
}

async function syncSignalements(db: admin.firestore.Firestore) {
    console.log('\n📍 Synchronisation des Signalements...');
    try {
        const result = await pool.query(`
      SELECT 
        s.id_signalement,
        ST_X(s.location) as longitude,
        ST_Y(s.location) as latitude,
        s.description,
        s.date_signalement,
        s.firebase_id,
        s.est_synchronise,
        s.updated_at,
        s.sync_version,
        u.id_user,
        u.display_name,
        u.email,
        st.id_status,
        st.libelle as status_name
      FROM Signalement s
      JOIN User_ u ON s.id_user = u.id_user
      JOIN Status st ON s.id_status = st.id_status
    `);

        let synced = 0;
        for (const row of result.rows) {
            try {
                const docRef = db.collection('signalements').doc(row.firebase_id || row.id_signalement.toString());
                await docRef.set({
                    id_signalement: row.id_signalement,
                    location: new admin.firestore.GeoPoint(row.latitude, row.longitude),
                    description: row.description,
                    date_signalement: new Date(row.date_signalement),
                    est_synchronise: row.est_synchronise,
                    updated_at: new Date(row.updated_at),
                    sync_version: row.sync_version,
                    user: {
                        id: row.id_user,
                        display_name: row.display_name,
                        email: row.email
                    },
                    status: {
                        id: row.id_status,
                        libelle: row.status_name
                    }
                });
                synced++;
            } catch (error: any) {
                console.error(`  ❌ Erreur sync signalement ${row.id_signalement}:`, error.message);
            }
        }

        console.log(`  ✅ ${synced}/${result.rows.length} signalements synchronisés`);
    } catch (error: any) {
        console.error('  ❌ Erreur lors de la synchronisation des signalements:', error.message);
    }
}

async function syncReparations(db: admin.firestore.Firestore) {
    console.log('\n🔧 Synchronisation des Réparations...');
    try {
        const result = await pool.query(`
      SELECT 
        r.id_reparation,
        r.surface_m2,
        r.budget,
        r.date_debut,
        r.date_fin_prevue,
        r.date_fin_reelle,
        r.commentaire,
        r.firebase_id,
        r.est_synchronise,
        r.updated_at,
        r.sync_version,
        r.id_signalement,
        r.id_entreprise,
        r.id_user,
        r.id_status,
        e.nom as entreprise_nom,
        u.display_name as manager_name,
        st.libelle as status_name
      FROM Reparation r
      LEFT JOIN Entreprise e ON r.id_entreprise = e.id_entreprise
      LEFT JOIN User_ u ON r.id_user = u.id_user
      JOIN Status st ON r.id_status = st.id_status
    `);

        let synced = 0;
        for (const row of result.rows) {
            try {
                const docRef = db.collection('reparations').doc(row.firebase_id || row.id_reparation.toString());
                await docRef.set({
                    id_reparation: row.id_reparation,
                    surface_m2: row.surface_m2,
                    budget: row.budget,
                    date_debut: row.date_debut ? new Date(row.date_debut) : null,
                    date_fin_prevue: row.date_fin_prevue ? new Date(row.date_fin_prevue) : null,
                    date_fin_reelle: row.date_fin_reelle ? new Date(row.date_fin_reelle) : null,
                    commentaire: row.commentaire,
                    est_synchronise: row.est_synchronise,
                    updated_at: new Date(row.updated_at),
                    sync_version: row.sync_version,
                    id_signalement: row.id_signalement,
                    id_entreprise: row.id_entreprise,
                    entreprise: row.entreprise_nom ? { nom: row.entreprise_nom } : null,
                    manager: row.manager_name ? { display_name: row.manager_name } : null,
                    status: {
                        id: row.id_status,
                        libelle: row.status_name
                    }
                });
                synced++;
            } catch (error: any) {
                console.error(`  ❌ Erreur sync réparation ${row.id_reparation}:`, error.message);
            }
        }

        console.log(`  ✅ ${synced}/${result.rows.length} réparations synchronisées`);
    } catch (error: any) {
        console.error('  ❌ Erreur lors de la synchronisation des réparations:', error.message);
    }
}

async function syncEntreprises(db: admin.firestore.Firestore) {
    console.log('\n🏢 Synchronisation des Entreprises...');
    try {
        const result = await pool.query(`
      SELECT 
        id_entreprise,
        nom,
        telephone,
        email,
        adresse,
        firebase_id,
        est_synchronise,
        updated_at,
        sync_version
      FROM Entreprise
    `);

        let synced = 0;
        for (const row of result.rows) {
            try {
                const docRef = db.collection('entreprises').doc(row.firebase_id || row.id_entreprise.toString());
                await docRef.set({
                    id_entreprise: row.id_entreprise,
                    nom: row.nom,
                    telephone: row.telephone,
                    email: row.email,
                    adresse: row.adresse,
                    est_synchronise: row.est_synchronise,
                    updated_at: new Date(row.updated_at),
                    sync_version: row.sync_version
                });
                synced++;
            } catch (error: any) {
                console.error(`  ❌ Erreur sync entreprise ${row.id_entreprise}:`, error.message);
            }
        }

        console.log(`  ✅ ${synced}/${result.rows.length} entreprises synchronisées`);
    } catch (error: any) {
        console.error('  ❌ Erreur lors de la synchronisation des entreprises:', error.message);
    }
}

async function syncStatus(db: admin.firestore.Firestore) {
    console.log('\n📊 Synchronisation des Status...');
    try {
        const result = await pool.query(`
      SELECT 
        id_status,
        libelle,
        couleur,
        firebase_id,
        est_synchronise,
        updated_at,
        sync_version
      FROM Status
    `);

        let synced = 0;
        for (const row of result.rows) {
            try {
                const docRef = db.collection('status').doc(row.firebase_id || row.id_status.toString());
                await docRef.set({
                    id_status: row.id_status,
                    libelle: row.libelle,
                    couleur: row.couleur,
                    est_synchronise: row.est_synchronise,
                    updated_at: new Date(row.updated_at),
                    sync_version: row.sync_version
                });
                synced++;
            } catch (error: any) {
                console.error(`  ❌ Erreur sync status ${row.id_status}:`, error.message);
            }
        }

        console.log(`  ✅ ${synced}/${result.rows.length} statuts synchronisés`);
    } catch (error: any) {
        console.error('  ❌ Erreur lors de la synchronisation des statuts:', error.message);
    }
}

async function main() {
    console.log('🚀 Synchronisation PostgreSQL → Firebase');
    console.log('=====================================\n');

    try {
        const db = await initializeFirebase();
        console.log('✅ Firebase connecté');

        await syncSignalements(db);
        await syncReparations(db);
        await syncEntreprises(db);
        await syncStatus(db);

        console.log('\n✅ Synchronisation terminée !');
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Erreur:', error.message);
        process.exit(1);
    }
}

main();
