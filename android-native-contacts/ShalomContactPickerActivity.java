package com.shalom.app.contacts;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Sélecteur multi-contacts natif compatible toutes versions Android (API 21 à API 35+).
 * Permet de rechercher et cocher plusieurs contacts en une seule opération.
 */
public class ShalomContactPickerActivity extends Activity {
    public static final String EXTRA_SELECTED_CONTACT_IDS = "shalom_selected_contact_ids";

    private static class ContactRow {
        final String id;
        final String name;
        final String phonePreview;

        ContactRow(String id, String name, String phonePreview) {
            this.id = id;
            this.name = name;
            this.phonePreview = phonePreview;
        }
    }

    private final List<ContactRow> allContacts = new ArrayList<>();
    private final List<ContactRow> filteredContacts = new ArrayList<>();
    private final Set<String> selectedIds = new LinkedHashSet<>();

    private Button confirmBtn;
    private BaseAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        int pad = dp(16);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Sélectionner plusieurs contacts");
        title.setTextSize(18f);
        title.setTextColor(Color.parseColor("#0f172a"));
        root.addView(title);

        EditText searchBox = new EditText(this);
        searchBox.setHint("Rechercher un nom ou numéro...");
        LinearLayout.LayoutParams searchLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        searchLp.topMargin = dp(8);
        searchLp.bottomMargin = dp(8);
        root.addView(searchBox, searchLp);

        ListView listView = new ListView(this);
        LinearLayout.LayoutParams listLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        root.addView(listView, listLp);

        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.END);
        footer.setPadding(0, dp(10), 0, 0);

        Button cancelBtn = new Button(this);
        cancelBtn.setText("Annuler");
        cancelBtn.setOnClickListener(v -> {
            setResult(RESULT_CANCELED);
            finish();
        });
        footer.addView(cancelBtn);

        confirmBtn = new Button(this);
        confirmBtn.setText("Importer (0)");
        confirmBtn.setOnClickListener(v -> {
            Intent res = new Intent();
            res.putStringArrayListExtra(EXTRA_SELECTED_CONTACT_IDS, new ArrayList<>(selectedIds));
            setResult(RESULT_OK, res);
            finish();
        });
        footer.addView(confirmBtn);
        root.addView(footer);

        setContentView(root);

        adapter = new BaseAdapter() {
            @Override
            public int getCount() {
                return filteredContacts.size();
            }

            @Override
            public ContactRow getItem(int position) {
                return filteredContacts.get(position);
            }

            @Override
            public long getItemId(int position) {
                return position;
            }

            @Override
            public View getView(int position, View convertView, ViewGroup parent) {
                ContactRow row = getItem(position);
                LinearLayout item = new LinearLayout(ShalomContactPickerActivity.this);
                item.setOrientation(LinearLayout.HORIZONTAL);
                item.setGravity(Gravity.CENTER_VERTICAL);
                item.setPadding(dp(8), dp(12), dp(8), dp(12));

                CheckBox cb = new CheckBox(ShalomContactPickerActivity.this);
                cb.setChecked(selectedIds.contains(row.id));
                cb.setClickable(false);
                cb.setFocusable(false);
                item.addView(cb);

                LinearLayout col = new LinearLayout(ShalomContactPickerActivity.this);
                col.setOrientation(LinearLayout.VERTICAL);
                col.setPadding(dp(10), 0, 0, 0);

                TextView nameView = new TextView(ShalomContactPickerActivity.this);
                nameView.setText(row.name);
                nameView.setTextSize(15f);
                nameView.setTextColor(Color.parseColor("#0f172a"));
                col.addView(nameView);

                if (!row.phonePreview.isEmpty()) {
                    TextView phoneView = new TextView(ShalomContactPickerActivity.this);
                    phoneView.setText(row.phonePreview);
                    phoneView.setTextSize(12f);
                    phoneView.setTextColor(Color.parseColor("#64748b"));
                    col.addView(phoneView);
                }

                item.addView(col);
                return item;
            }
        };
        listView.setAdapter(adapter);

        listView.setOnItemClickListener((parent, view, position, id) -> {
            ContactRow row = filteredContacts.get(position);
            if (selectedIds.contains(row.id)) {
                selectedIds.remove(row.id);
            } else {
                selectedIds.add(row.id);
            }
            confirmBtn.setText("Importer (" + selectedIds.size() + ")");
            adapter.notifyDataSetChanged();
        });

        searchBox.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                filterList(s == null ? "" : s.toString());
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        loadPhoneContacts();
    }

    private void loadPhoneContacts() {
        new Thread(() -> {
            ContentResolver cr = getContentResolver();
            List<ContactRow> loaded = new ArrayList<>();
            try (Cursor c = cr.query(
                    ContactsContract.Contacts.CONTENT_URI,
                    new String[]{
                            ContactsContract.Contacts._ID,
                            ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
                            ContactsContract.Contacts.HAS_PHONE_NUMBER
                    },
                    null,
                    null,
                    ContactsContract.Contacts.DISPLAY_NAME_PRIMARY + " ASC")) {
                if (c != null) {
                    while (c.moveToNext()) {
                        String id = c.getString(0);
                        String name = c.getString(1);
                        int hasPhone = c.getInt(2);
                        if (name == null || name.trim().isEmpty()) name = "Contact";
                        loaded.add(new ContactRow(id, name.trim(), hasPhone > 0 ? "Numéro disponible" : "Sans numéro"));
                    }
                }
            }
            runOnUiThread(() -> {
                allContacts.clear();
                allContacts.addAll(loaded);
                filterList("");
            });
        }).start();
    }

    private void filterList(String query) {
        String q = query.trim().toLowerCase(Locale.getDefault());
        filteredContacts.clear();
        for (ContactRow r : allContacts) {
            if (q.isEmpty() || r.name.toLowerCase(Locale.getDefault()).contains(q)) {
                filteredContacts.add(r);
            }
        }
        adapter.notifyDataSetChanged();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
