# MobilyaOS — Codex Profesyonel Ürün Üretim Paketi

Bu paket, **Mobilya Agentik Teklif, Tasarım ve Üretim Platformu** mimarisini Codex ile tek ana görev üzerinden mümkün olan en yüksek ürün kalitesine yakın biçimde geliştirmek için hazırlanmıştır.

## Paket ne sağlar?

- Codex için kök ve klasör bazlı `AGENTS.md` talimatları
- Claude prompt dokümantasyonundaki yapılandırma ilkelerine göre runtime system promptları
- Codex custom subagent tanımları ve repo skills
- Tek seferde kullanılacak kapsamlı ana uygulama promptu
- Ürün kapsamı, domain kuralları, veri modeli, event/API sözleşmeleri
- Tool kataloğu ve JSON Schema tabanlı yapılandırılmış çıktılar
- Prompt ve ürün kabul testleri
- Güvenlik, tenant izolasyonu, onay ve audit kuralları
- Docker tabanlı yerel geliştirme hedefi ve çevre değişkenleri

## Önerilen kullanım

1. Bu paketi boş bir Git repository köküne çıkarın.
2. Codex CLI veya Codex App ile repository'yi güvenilir proje olarak açın.
3. `README_TR.md`, `AGENTS.md` ve `.codex/config.toml` dosyalarının repository kökünde olduğundan emin olun.
4. Codex'e yalnızca şu dosyanın tamamını görev olarak verin:

   `CODEX_ONE_SHOT_PROMPT.md`

5. Codex'in alt-agent oluşturmasına, bağımlılık kurmasına, dosya yazmasına ve test çalıştırmasına izin verin. Dış servis anahtarı gerektiren entegrasyonlar mock veya adapter modunda kalmalıdır.
6. Çalışma sonunda `make verify` veya Codex'in oluşturduğu eşdeğer doğrulama komutunu çalıştırın.

## Hedef çıktı

Paket, tüm kurumsal ERP/CAD kapsamını tek çalışmada bitirmeyi vaat etmez. Bunun yerine:

- çalıştırılabilir,
- testli,
- güvenli varsayılanlara sahip,
- profesyonel görünümlü,
- gerçek domain kurallarını kullanan,
- sonraki modüllere genişletilebilir

bir **üretim kalitesine yakın dikey ürün dilimi** oluşturmayı hedefler.

## Dil kararı

- Kod, commit mesajları, teknik şemalar ve API isimleri: İngilizce
- Ürün arayüzü ve demo verileri: Türkçe (`tr-TR`)
- Para birimi varsayılanı: TRY
- Ölçü birimi: mm; alan: m²; uzunluk: m

## Güvenlik uyarısı

Codex'e gerçek tedarikçi portal parolaları, müşteri kişisel verileri veya üretim sistemlerinin gizli anahtarları verilmemelidir. `.env.example` yalnız örnek değer içerir. Gerçek sırlar secret manager veya yerel `.env` içinde tutulur ve Git'e eklenmez.
