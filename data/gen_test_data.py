import struct
import sys
import random

sys.stdout.write("""name: test_file
encoding: binary
metadata: location__origin degrees_mercator_quadtree25
field: location nc_dim_quadtree_25
field: test_category nc_dim_cat_1
valname: test_category 0 CATEGORY_A
valname: test_category 1 CATEGORY_B
metadata: tbin 2016-01-01_00:00:00_3600s
field: time nc_dim_time_2
field: count1 nc_var_float_8
field: count2 nc_var_float_8\n
""")

for i in xrange(10001):
    if i % 2 == 0:
        x = random.normalvariate(0, 10000)
    else:
        x = random.normalvariate(10000, 10000)
    v = struct.pack('<iiBHdd', int(x + (1 << 24)), 1 << 24, i % 2, int(i ** 0.5), 1.3, 1.5)
    sys.stdout.write(v)
