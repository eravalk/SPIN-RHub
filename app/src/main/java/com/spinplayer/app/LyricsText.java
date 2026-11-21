package com.spinplayer.app;
import java.io.*;import java.nio.*;import java.nio.charset.*;
public final class LyricsText {
 public static String validate(String s)throws IOException{if(s==null)throw new IOException("Пустой текст");s=s.replace("\uFEFF", "").replace("\r\n","\n").replace('\r','\n').trim();if(s.isEmpty())throw new IOException("В файле нет текста");if(s.length()>250000)throw new IOException("Текст слишком большой (максимум 250 000 символов)");for(int i=0;i<s.length();i++)if(s.charAt(i)<32&&s.charAt(i)!='\n'&&s.charAt(i)!='\t')throw new IOException("Это не текстовый файл. Выбери TXT или LRC");return s;}
 public static String decode(byte[] b)throws IOException{if(b.length>1024*1024)throw new IOException("Файл больше 1 МБ");String s;if(b.length>=2&&(b[0]&255)==255&&(b[1]&255)==254)s=new String(b,2,b.length-2,StandardCharsets.UTF_16LE);else if(b.length>=2&&(b[0]&255)==254&&(b[1]&255)==255)s=new String(b,2,b.length-2,StandardCharsets.UTF_16BE);else try{s=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString();}catch(CharacterCodingException e){s=new String(b,Charset.forName("windows-1251"));}return validate(s);}
 public static boolean synced(String s){return s.matches("(?s).*\\[\\d+:\\d{2}(?:[.:]\\d{1,3})?\\].*");}
}
