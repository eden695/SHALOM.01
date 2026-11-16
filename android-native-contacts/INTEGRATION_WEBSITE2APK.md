# Intégration Android Native — Sélecteur Multi-Contacts SHALOM

## Limitation importante concernant Website 2 APK Builder Pro

L'outil **Website 2 APK Builder Pro** génère un APK à partir du dossier web (`dist/` ou `docs/`) mais **ne permet pas d'ajouter ou de compiler de nouveaux fichiers `.java`** ni d'enregistrer une interface `@JavascriptInterface` personnalisée directement depuis son interface graphique.

Par conséquent, pour que le sélecteur natif multi-contacts Android (`window.ShalomAndroidContacts`) fonctionne dans l'APK final :
1. **Option recommandée (Projet Android Studio / Wrapper WebView complet)** :
   - Copiez `ShalomContactsBridge.java` et `ShalomContactPickerActivity.java` dans `app/src/main/java/com/shalom/app/contacts/`.
   - Ajoutez la permission `android.permission.READ_CONTACTS` et la déclaration de `ShalomContactPickerActivity` (voir `AndroidManifest_snippet.xml`).
   - Dans votre `MainActivity.java` contenant la `WebView` :
     ```java
     private ShalomContactsBridge shalomContactsBridge;

     // Dans onCreate :
     shalomContactsBridge = new ShalomContactsBridge(this, webView);
     webView.getSettings().setJavaScriptEnabled(true);
     webView.addJavascriptInterface(shalomContactsBridge, "ShalomAndroidContacts");

     // Relayer les résultats :
     @Override
     public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
         super.onRequestPermissionsResult(requestCode, permissions, grantResults);
         if (shalomContactsBridge != null) {
             shalomContactsBridge.onRequestPermissionsResult(requestCode, grantResults);
         }
     }

     @Override
     protected void onActivityResult(int requestCode, int resultCode, Intent data) {
         super.onActivityResult(requestCode, resultCode, data);
         if (shalomContactsBridge != null) {
             shalomContactsBridge.onActivityResult(requestCode, resultCode, data);
         }
     }
     ```
2. **En utilisant uniquement Website 2 APK Builder Pro (sans modification Java)** :
   - SHALOM détecte automatiquement l'absence du pont natif dans la WebView et utilise en priorité `navigator.contacts.select` (si la WebView Chromium du téléphone le supporte), puis propose immédiatement l'importation multi-contacts `.vcf` depuis le gestionnaire de fichiers Android (exporter ses contacts depuis l'app Contacts Android en `.vcf`, puis sélectionner le fichier dans SHALOM en une seule fois).
