import json
import datetime

def date_format(field):
    if type(field) is datetime:
        return field.strftime("%Y-%m-%d %H:%M:%S")

def tt_to_json_string(ttobject):
    return json.dumps(ttobject.to_dict(), default=date_format)

def ttjson(ttobject):
    tt_str = tt_to_json_string(ttobject)
    return json.loads(tt_str)