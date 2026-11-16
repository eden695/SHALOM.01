package com.shalom.app.contacts;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.ContactsContract;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Pont JavaScript natif Android pour SHALOM.
 * À enregistrer dans la WebView Android :
 *   webView.addJavascriptInterface(new ShalomContactsBridge(this, webView), "ShalomAndroidContacts");
 *
 * Puis transférer onActivityResult et onRequestPermissionsResult depuis l'Activity principale vers ce pont.
 */
public class ShalomContactsBridge {
    public static final int REQ_CONTACT_PERMISSION = 4101;
    public static final int REQ_MULTI_CONTACT_PICKER = 4102;
    public static final int REQ_SYSTEM_SINGLE_PICKER = 4103;

    private final Activity activity;
    private final WebView webView;
    private String pendingCallbackName = "__shalomOnAndroidContactsResult";

    public ShalomContactsBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return true;
    }

    @JavascriptInterface
    public boolean supportsMultiSelect() {
        return true;
    }

    @JavascriptInterface
    public void pickMultipleContacts(final String callbackName) {
        this.pendingCallbackName = (callbackName != null && !callbackName.isEmpty())
                ? callbackName
                : "__shalomOnAndroidContactsResult";

        activity.runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                    activity.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
                activity.requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, REQ_CONTACT_PERMISSION);
                return;
            }
            launchPicker();
        });
    }

    private void launchPicker() {
        try {
            // Sélecteur multi-contacts intégré (compatible Android 5 à Android 15+)
            Intent multiIntent = new Intent(activity, ShalomContactPickerActivity.class);
            activity.startActivityForResult(multiIntent, REQ_MULTI_CONTACT_PICKER);
        } catch (Exception e) {
            // Repli système si l'Activity multi-sélection n'est pas enregistrée dans le Manifest
            try {
                Intent systemPick = new Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                    systemPick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                activity.startActivityForResult(systemPick, REQ_SYSTEM_SINGLE_PICKER);
            } catch (Exception ex) {
                dispatchError("PICKER_UNAVAILABLE", "Aucun sélecteur de contacts disponible sur cet appareil.");
            }
        }
    }

    public void onRequestPermissionsResult(int requestCode, int[] grantResults) {
        if (requestCode != REQ_CONTACT_PERMISSION) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            launchPicker();
        } else {
            dispatchError("PERMISSION_DENIED", "Autorisation READ_CONTACTS refusée par l'utilisateur.");
        }
    }

    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_MULTI_CONTACT_PICKER && requestCode != REQ_SYSTEM_SINGLE_PICKER) return;

        if (resultCode != Activity.RESULT_OK || data == null) {
            dispatchError("CANCELLED", "Sélection annulée.");
            return;
        }

        new Thread(() -> {
            try {
                if (requestCode == REQ_MULTI_CONTACT_PICKER) {
                    ArrayList<String> contactIds = data.getStringArrayListExtra(ShalomContactPickerActivity.EXTRA_SELECTED_CONTACT_IDS);
                    if (contactIds == null || contactIds.isEmpty()) {
                        dispatchError("CANCELLED", "Aucun contact coché.");
                        return;
                    }
                    JSONArray arr = readContactsByIds(contactIds);
                    dispatchSuccess(arr.toString());
                    return;
                }

                // Fallback Intent.ACTION_PICK (un seul contact ou ClipData multi-URIs sur certaines ROM Android)
                List<String> ids = new ArrayList<>();
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        String id = resolveContactIdFromUri(clipData.getItemAt(i).getUri());
                        if (id != null) ids.add(id);
                    }
                } else if (data.getData() != null) {
                    String id = resolveContactIdFromUri(data.getData());
                    if (id != null) ids.add(id);
                }

                if (ids.isEmpty()) {
                    dispatchError("DATA_ERROR", "Impossible de lire les identifiants des contacts.");
                    return;
                }

                JSONArray arr = readContactsByIds(ids);
                dispatchSuccess(arr.toString());
            } catch (SecurityException se) {
                dispatchError("PERMISSION_DENIED", "Permission READ_CONTACTS manquante.");
            } catch (Exception ex) {
                dispatchError("DATA_ERROR", ex.getMessage());
            }
        }).start();
    }

    private String resolveContactIdFromUri(Uri uri) {
        if (uri == null) return null;
        ContentResolver cr = activity.getContentResolver();
        try (Cursor c = cr.query(uri, new String[]{ContactsContract.Contacts._ID}, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                return c.getString(0);
            }
        }
        return uri.getLastPathSegment();
    }

    private JSONArray readContactsByIds(List<String> contactIds) throws Exception {
        ContentResolver cr = activity.getContentResolver();
        JSONArray result = new JSONArray();

        for (String contactId : contactIds) {
            String displayName = "";
            String firstName = "";
            String lastName = "";
            String photoDataUrl = "";
            Set<String> phones = new LinkedHashSet<>();
            Set<String> emails = new LinkedHashSet<>();

            try (Cursor c = cr.query(
                    ContactsContract.Contacts.CONTENT_URI,
                    new String[]{ContactsContract.Contacts.DISPLAY_NAME_PRIMARY},
                    ContactsContract.Contacts._ID + " = ?",
                    new String[]{contactId},
                    null)) {
                if (c != null && c.moveToFirst()) {
                    displayName = c.getString(0);
                }
            }

            // Prénom / Nom structurés
            try (Cursor sc = cr.query(
                    ContactsContract.Data.CONTENT_URI,
                    new String[]{
                            ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME,
                            ContactsContract.CommonDataKinds.StructuredName.FAMILY_NAME
                    },
                    ContactsContract.Data.CONTACT_ID + " = ? AND " + ContactsContract.Data.MIMETYPE + " = ?",
                    new String[]{contactId, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE},
                    null)) {
                if (sc != null && sc.moveToFirst()) {
                    firstName = safeStr(sc.getString(0));
                    lastName = safeStr(sc.getString(1));
                }
            }

            // Numéros de téléphone
            try (Cursor pc = cr.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    new String[]{ContactsContract.CommonDataKinds.Phone.NUMBER},
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
                    new String[]{contactId},
                    null)) {
                if (pc != null) {
                    while (pc.moveToNext()) {
                        String num = safeStr(pc.getString(0));
                        if (!num.isEmpty()) phones.add(num);
                    }
                }
            }

            // Adresses e-mail (optionnelles)
            try (Cursor ec = cr.query(
                    ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                    new String[]{ContactsContract.CommonDataKinds.Email.ADDRESS},
                    ContactsContract.CommonDataKinds.Email.CONTACT_ID + " = ?",
                    new String[]{contactId},
                    null)) {
                if (ec != null) {
                    while (ec.moveToNext()) {
                        String mail = safeStr(ec.getString(0));
                        if (!mail.isEmpty()) emails.add(mail);
                    }
                }
            }

            // Photo miniature si disponible
            Uri contactUri = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI, contactId);
            try (InputStream photoStream = ContactsContract.Contacts.openContactPhotoInputStream(cr, contactUri, false)) {
                if (photoStream != null) {
                    Bitmap bmp = BitmapFactory.decodeStream(photoStream);
                    if (bmp != null) {
                        Bitmap scaled = Bitmap.createScaledBitmap(bmp, 96, 96, true);
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        scaled.compress(Bitmap.CompressFormat.JPEG, 75, baos);
                        photoDataUrl = "data:image/jpeg;base64," + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                    }
                }
            } catch (Exception ignored) {}

            JSONObject obj = new JSONObject();
            obj.put("externalId", "android_" + contactId);
            obj.put("displayName", safeStr(displayName));
            obj.put("firstName", firstName);
            obj.put("lastName", lastName);
            obj.put("phones", new JSONArray(phones));
            obj.put("emails", new JSONArray(emails));
            if (!photoDataUrl.isEmpty()) {
                obj.put("photoDataUrl", photoDataUrl);
            }
            result.put(obj);
        }

        return result;
    }

    private String safeStr(String s) {
        return s == null ? "" : s.trim();
    }

    private void dispatchSuccess(final String jsonArrayStr) {
        activity.runOnUiThread(() -> {
            String js = "window['" + pendingCallbackName + "'] && window['" + pendingCallbackName + "'](" + JSONObject.quote(jsonArrayStr) + ");";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                webView.evaluateJavascript(js, null);
            } else {
                webView.loadUrl("javascript:" + js);
            }
        });
    }

    private void dispatchError(final String code, final String message) {
        activity.runOnUiThread(() -> {
            String js = "window.__shalomOnAndroidContactsError && window.__shalomOnAndroidContactsError(" +
                    JSONObject.quote(code) + "," + JSONObject.quote(safeStr(message)) + ");";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                webView.evaluateJavascript(js, null);
            } else {
                webView.loadUrl("javascript:" + js);
            }
        });
    }
}
