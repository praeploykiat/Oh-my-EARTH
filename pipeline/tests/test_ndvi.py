"""Offline QA parsing checks for background AppEEARS ingestion."""
import csv
import pytest
from src.ndvi import read_point_csv, LAYERS

@pytest.mark.parametrize("latitude", ["nan", "inf", "14.0"])
def test_wrong_or_nonfinite_response_coordinates_are_rejected(tmp_path, latitude):
    path=tmp_path/"results.csv"
    names=["ID","Latitude","Longitude","Date"]+["MOD13A3_061_"+layer for layer in LAYERS]
    with path.open("w",newline="") as stream:
        writer=csv.writer(stream);writer.writerow(names)
        writer.writerow(["TH",latitude,"100.52","2001-01-01",0.3,2048,0])
    with pytest.raises(ValueError,match="coordinates"):
        read_point_csv(path,{"TH":{"lat":13.75,"lon":100.52}})
