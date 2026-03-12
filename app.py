import csv
import re

def strip_maker_from_sku(sku: str, maker: str) -> str:
    sku = (sku or "").strip()
    maker = (maker or "").strip()

    if not sku:
        return ""

    if not maker:
        return sku

    # Usuń producenta tylko jeśli jest na początku SKU (case-insensitive)
    # Przykład: "SACHS 2290 601 112" + "SACHS" => "2290 601 112"
    pattern = r"^\s*" + re.escape(maker) + r"\s+"
    out = re.sub(pattern, "", sku, flags=re.IGNORECASE).strip()

    return out

def convert_csv(input_path: str, output_path: str, delimiter_in: str = ",", delimiter_out: str = ","):
    with open(input_path, "r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(2048)
        f.seek(0)

        # Spróbuj wykryć czy jest nagłówek:
        has_header = any(h in sample.lower() for h in ["id", "sku", "vyrobce", "producent", "manufacturer"])

        reader = csv.reader(f, delimiter=delimiter_in)

        if has_header:
            header = next(reader, None)
            # Mapowanie kolumn po nazwach (luźno)
            header_l = [h.strip().lower() for h in (header or [])]

            def find_col(*names):
                for n in names:
                    if n in header_l:
                        return header_l.index(n)
                return None

            i_id = find_col("id")
            i_sku = find_col("sku")
            i_maker = find_col("vyrobce", "producer", "manufacturer")

            if i_id is None or i_sku is None or i_maker is None:
                raise ValueError(f"Nie mogę znaleźć kolumn ID/SKU/VYROBCE w nagłówku: {header}")

        else:
            # Bez nagłówka zakładamy: ID, SKU, VYROBCE
            i_id, i_sku, i_maker = 0, 1, 2

        with open(output_path, "w", encoding="utf-8", newline="") as out:
            writer = csv.writer(out, delimiter=delimiter_out)
            writer.writerow(["ID", "Vyrobce", "Number"])

            for row in reader:
                if not row or len(row) < 3:
                    continue

                id_val = row[i_id].strip()
                sku_val = row[i_sku].strip()
                maker_val = row[i_maker].strip()

                number = strip_maker_from_sku(sku_val, maker_val)

                writer.writerow([id_val, maker_val, number])

if __name__ == "__main__":
    # Zmień nazwy plików:
    convert_csv("input.csv", "output.csv", delimiter_in=",", delimiter_out=",")
    print("OK -> output.csv")