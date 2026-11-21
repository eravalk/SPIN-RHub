package com.spinplayer.app;

import android.app.AlertDialog;
import android.content.*;
import android.net.Uri;
import android.security.keystore.*;
import android.text.InputType;
import android.util.Base64;
import android.widget.*;
import java.io.IOException;
import java.security.KeyStore;
import java.util.concurrent.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

final class MusicConnections {
 static final String YANDEX_OAUTH="https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d";
 final MainActivity activity;
 final SpotifyAnonymous anonymous;
 final ExecutorService io=Executors.newSingleThreadExecutor();
 MusicConnections(MainActivity a){activity=a;anonymous=new SpotifyAnonymous(a);}
 static synchronized javax.crypto.SecretKey key()throws Exception{
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);String alias="spin-music-connections-v1";
  if(store.containsAlias(alias))return (javax.crypto.SecretKey)store.getKey(alias,null);
  KeyGenerator generator=KeyGenerator.getInstance("AES","AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
 }
 SharedPreferences prefs(){return activity.getSharedPreferences("music-connections",0);}
 synchronized JSONObject read(String service)throws Exception{return readStored(activity,service);}
 static synchronized JSONObject readStored(android.content.Context context,String service)throws Exception{
  String value=context.getSharedPreferences("music-connections",0).getString(service,"");if(value.isEmpty())return new JSONObject();String[] p=value.split("\\.");
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(p[0],Base64.NO_WRAP)));cipher.updateAAD(service.getBytes("UTF-8"));return new JSONObject(new String(cipher.doFinal(Base64.decode(p[1],Base64.NO_WRAP)),"UTF-8"));
 }
 synchronized void save(String service,JSONObject value)throws Exception{
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());cipher.updateAAD(service.getBytes("UTF-8"));
  String data=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+"."+Base64.encodeToString(cipher.doFinal(value.toString().getBytes("UTF-8")),Base64.NO_WRAP);
  if(!prefs().edit().putString(service,data).commit())throw new IOException("Не удалось сохранить подключение");
 }
 void status(){io.execute(()->{try{activity.send("spinMusicConnections",new JSONObject().put("yandex",!read("yandex").optString("token").isEmpty()).put("spotify",!read("spotify").optString("client_id").isEmpty()));}catch(Exception e){activity.send("spinToast",JSONObject.quote("Не удалось открыть сохранённые подключения"));}});}
 void disconnect(String service){if(!service.equals("yandex")&&!service.equals("spotify"))return;io.execute(()->{prefs().edit().remove(service).commit();status();});}
 String yandexToken()throws Exception{return read("yandex").optString("token");}
 String spotifyToken()throws Exception{
  JSONObject value=read("spotify");if(value.optString("client_id").isEmpty())throw new IOException("Для поиска Spotify подключи каталог в настройках. Публичный альбом или трек можно открыть по ссылке без подключения.");
  if(value.optLong("expires")>System.currentTimeMillis()+60000)return value.getString("access_token");
  String auth="Basic "+Base64.encodeToString((value.getString("client_id")+":"+value.getString("client_secret")).getBytes("UTF-8"),Base64.NO_WRAP);
  JSONObject token=ProviderHttp.json("https://accounts.spotify.com/api/token",auth,"grant_type=client_credentials");
  value.put("access_token",token.getString("access_token")).put("expires",System.currentTimeMillis()+token.optLong("expires_in",3600)*1000);save("spotify",value);return value.getString("access_token");
 }
 void connect(String service){if(!service.equals("yandex")&&!service.equals("spotify"))return;activity.runOnUiThread(()->{
  LinearLayout box=new LinearLayout(activity);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(36,10,36,10);
  TextView help=new TextView(activity);boolean yandex=service.equals("yandex");
  help.setText(yandex?"Открой вход Яндекса. После подтверждения скопируй адрес с access_token и вставь ниже. Пароль вводится только на странице Яндекса.":"Для поиска по каталогу Spotify нужны Client ID и Client Secret собственного приложения Spotify Developer. Публичные ссылки на треки и альбомы можно открывать без этой настройки.");box.addView(help);
  EditText first=new EditText(activity);first.setSingleLine();first.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);first.setHint(yandex?"Токен или адрес с access_token":"Client ID");box.addView(first);
  EditText second=new EditText(activity);second.setSingleLine();second.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);second.setHint("Client Secret");if(!yandex)box.addView(second);
  AlertDialog dialog=new AlertDialog.Builder(activity).setTitle(yandex?"Подключить Яндекс Музыку":"Подключить каталог Spotify").setView(box).setNegativeButton("Отмена",null).setNeutralButton(yandex?"Открыть вход":"Spotify Developer",null).setPositiveButton("Сохранить",null).create();
  dialog.setOnShowListener(v->{dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(b->{try{activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(yandex?YANDEX_OAUTH:"https://developer.spotify.com/dashboard")));}catch(Exception e){activity.send("spinToast",JSONObject.quote("Не удалось открыть браузер"));}});
   dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(b->{String a=first.getText().toString().trim(),s=second.getText().toString().trim();if(a.isEmpty()||(!yandex&&s.isEmpty())){first.setError("Заполни параметры подключения");return;}
    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
    io.execute(()->{try{
     if(yandex){String token=parseYandexToken(a);JSONObject result=ProviderHttp.json("https://api.music.yandex.net/account/status","OAuth "+token,null);if(result.optJSONObject("result")==null)throw new IOException("Яндекс не подтвердил доступ");save("yandex",new JSONObject().put("token",token));}
     else{if(!a.matches("[A-Za-z0-9]{16,128}")||!s.matches("[A-Za-z0-9]{16,128}"))throw new IOException("Проверь Client ID и Client Secret");String auth="Basic "+Base64.encodeToString((a+":"+s).getBytes("UTF-8"),Base64.NO_WRAP);JSONObject token=ProviderHttp.json("https://accounts.spotify.com/api/token",auth,"grant_type=client_credentials");save("spotify",new JSONObject().put("client_id",a).put("client_secret",s).put("access_token",token.getString("access_token")).put("expires",System.currentTimeMillis()+token.optLong("expires_in",3600)*1000));}
     activity.runOnUiThread(()->{first.setText("");second.setText("");dialog.dismiss();});status();activity.send("spinToast",JSONObject.quote("Подключение сохранено"));
    }catch(Exception e){activity.runOnUiThread(()->{dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);first.setError("Не удалось подтвердить подключение. Проверь данные и доступ сервиса.");});}
    });
   });
  });dialog.show();if(dialog.getWindow()!=null)dialog.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
 });}
 static String parseYandexToken(String value)throws Exception{
  String token=value.trim();if(token.startsWith("https://")){Uri uri=Uri.parse(token);String h=uri.getHost();if(h==null||!(h.equals("oauth.yandex.ru")||h.equals("oauth.yandex.com")))throw new IOException("Нужен адрес возврата Яндекса");String fragment=uri.getEncodedFragment();token=Uri.parse("https://oauth.yandex.ru/?"+(fragment==null?"":fragment)).getQueryParameter("access_token");}
  if(token==null||!token.matches("[A-Za-z0-9_.-]{20,4096}"))throw new IOException("Неверный формат токена");return token;
 }
 void close(){anonymous.close();io.shutdown();}
}
