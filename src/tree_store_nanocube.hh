#pragma once

#include "address.hh"
#include "tree_store.hh"

#include <iostream>

namespace nanocube {

//-----------------------------------------------------------------
// SimpleConfig
//-----------------------------------------------------------------

template<unsigned N>
struct FixedVector {
    double vec[N] = {0.0f};
};

template <unsigned N>
std::ostream& operator << (std::ostream& output, const FixedVector<N>& c)
{
    output << "[";
    for (int i = 0; i < N; i ++) {
        output << c.vec[i];
        if(i < N-1) {
            output << ", ";
        }
    }
    output << "]";
    return output;
}

template <unsigned N>
FixedVector<N> operator + (FixedVector<N>& a,FixedVector<N>& b)
{
    FixedVector<N> output;
    for (int i = 0; i < N; i ++) {
        output.vec[i] = a.vec[i]+b.vec[i];
    }
    return output;
}

template <unsigned N>
FixedVector<N> operator - (FixedVector<N>& a,FixedVector<N>& b)
{
    FixedVector<N> output;
    for (int i = 0; i < N; i ++) {
        output.vec[i] = a.vec[i]-b.vec[i];
    }
    return output;
}

template <unsigned N>
bool operator == (FixedVector<N>& a,FixedVector<N>& b)
{
    bool equal = true;
    for (int i = 0; i < N; i ++) {
        if(a.vec[i] != b.vec[i]){
            equal = false;
            break;
        }
    }
    return equal;
}

////////////////////////////////////////////////////////////////////


struct SimpleConfig {
    
    using label_type       = ::nanocube::DimAddress;
    using label_item_type  = typename label_type::value_type;
    using value_type       = FixedVector<2>;
    using parameter_type   = int; // dummy parameter
    
    static const value_type default_value;
    static const value_type zero_value;
    
    std::size_t operator()(const label_type &label) const;
    
    std::ostream& print_label(std::ostream& os, const label_type &label) const;
    
    std::ostream& print_value(std::ostream& os, const value_type &value, const parameter_type& parameter) const;
    
    std::ostream& serialize_label(std::ostream& os, const label_type &label);
    
    std::istream& deserialize_label(std::istream& is, label_type &label);
    
    std::ostream& serialize_value(std::ostream& os, const value_type &value);
    
    std::istream& deserialize_value(std::istream& is, value_type &value);
    
};

using TreeValue = tree_store::TreeStore<SimpleConfig>;
using TreeValueBuilder = tree_store::TreeStoreBuilder<TreeValue>;

using TreeValueIterator = tree_store::TreeStoreIterator<TreeValue>;

    
}
