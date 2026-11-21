package com.spinplayer.app;
import android.content.Context;import java.io.*;import java.util.*;import org.json.*;
/** Overrides live exclusively in SPIN. Audio files are never opened for writing. */
final class LibraryEditor {
 static boolean album(JSONObject t){String a=t.optString("album").trim();return !a.isEmpty()&&!Arrays.asList("Без альбома","Скачанное","Мои файлы","Скачано").contains(a);}
 static String key(JSONObject t){return (t.optString("albumArtist").isEmpty()?t.optString("artist"):t.optString("albumArtist"))+"\n"+t.optString("album");}
 static JSONArray save(Context c,JSONObject edit,byte[] picture)throws Exception{synchronized(MusicLibrary.class){
  JSONArray list=MusicLibrary.load(c);JSONObject target=null;for(int i=0;i<list.length();i++)if(list.getJSONObject(i).optInt("id")==edit.getInt("id"))target=list.getJSONObject(i);
  if(target==null)throw new IOException("Песня больше не найдена");String name=edit.optString("name").trim(),year=edit.optString("year",target.optString("year")).trim();if(name.isEmpty())throw new IOException("Введи название");if(!year.isEmpty()&&!year.matches("[12][0-9]{3}"))throw new IOException("Год должен состоять из четырёх цифр");
  boolean all=edit.optBoolean("albumScope");if(all&&!album(target))throw new IOException("У песни нет альбома");String group=key(target);List<JSONObject> affected=new ArrayList<>();for(int i=0;i<list.length();i++){JSONObject t=list.getJSONObject(i);if(t==target||(all&&album(t)&&key(t).equals(group)))affected.add(t);}
  File written=null;try{String cover=null;if(picture!=null&&!edit.optBoolean("resetCover")){File dir=new File(c.getFilesDir(),"art");dir.mkdirs();written=File.createTempFile("cover-edit-",".jpg",dir);try(FileOutputStream out=new FileOutputStream(written)){out.write(picture);}cover="art/"+written.getName();}
   for(JSONObject t:affected){if(!t.has("originalCover"))t.put("originalCover",t.optString("cover","app-cover.svg"));if(edit.optBoolean("resetCover"))t.put("cover",t.getString("originalCover"));else if(cover!=null)t.put("cover",cover);if(edit.has("year"))t.put("year",year);}
   if(!name.equals(target.optString("name"))||!edit.optString("artist").equals(target.optString("artist")))c.getSharedPreferences("spin",0).edit().remove("lyricsQuery:"+target.optInt("id")).apply();
   target.put("name",name).put("artist",edit.optString("artist","Неизвестный исполнитель")).put("album",edit.optString("album","Без альбома"));
   if(!c.getSharedPreferences("spin",0).edit().putString("library",list.toString()).commit())throw new IOException("Не удалось сохранить библиотеку");SpinWidget.refresh(c);return list;
  }catch(Exception e){if(written!=null)written.delete();throw e;}
 }}
}
